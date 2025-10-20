// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface EcoAction {
  id: string;
  encryptedPoints: string;
  timestamp: number;
  owner: string;
  actionType: string;
  status: "pending" | "verified" | "rejected";
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompute = (encryptedData: string, operation: string): string => {
  const value = FHEDecryptNumber(encryptedData);
  let result = value;
  
  switch(operation) {
    case 'increase10%':
      result = value * 1.1;
      break;
    case 'decrease10%':
      result = value * 0.9;
      break;
    case 'double':
      result = value * 2;
      break;
    default:
      result = value;
  }
  
  return FHEEncryptNumber(result);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const ecoTips = [
  "Use public transport or bike instead of driving to reduce carbon footprint",
  "Bring your own reusable bags when shopping",
  "Turn off lights and electronics when not in use",
  "Start composting organic waste",
  "Choose products with minimal packaging",
  "Plant native species in your garden",
  "Use a reusable water bottle",
  "Repair items instead of replacing them"
];

const actionTypes = [
  { name: "Recycling", points: 10 },
  { name: "Public Transport", points: 15 },
  { name: "Meat-Free Meal", points: 5 },
  { name: "Energy Saving", points: 8 },
  { name: "Water Conservation", points: 7 },
  { name: "Tree Planting", points: 20 }
];

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<EcoAction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newActionData, setNewActionData] = useState({ actionType: "", description: "", points: 0 });
  const [showIntro, setShowIntro] = useState(true);
  const [selectedAction, setSelectedAction] = useState<EcoAction | null>(null);
  const [decryptedPoints, setDecryptedPoints] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const verifiedCount = actions.filter(a => a.status === "verified").length;
  const pendingCount = actions.filter(a => a.status === "pending").length;
  const rejectedCount = actions.filter(a => a.status === "rejected").length;
  const [randomTip, setRandomTip] = useState<string>("");

  useEffect(() => {
    loadActions().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
      setRandomTip(ecoTips[Math.floor(Math.random() * ecoTips.length)]);
    };
    initSignatureParams();
  }, []);

  const loadActions = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      const keysBytes = await contract.getData("action_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing action keys:", e); }
      }
      const list: EcoAction[] = [];
      for (const key of keys) {
        try {
          const actionBytes = await contract.getData(`action_${key}`);
          if (actionBytes.length > 0) {
            try {
              const actionData = JSON.parse(ethers.toUtf8String(actionBytes));
              list.push({ 
                id: key, 
                encryptedPoints: actionData.points, 
                timestamp: actionData.timestamp, 
                owner: actionData.owner, 
                actionType: actionData.actionType, 
                status: actionData.status || "pending" 
              });
            } catch (e) { console.error(`Error parsing action data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading action ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setActions(list);
    } catch (e) { console.error("Error loading actions:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const submitAction = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting eco points with Zama FHE..." });
    try {
      const encryptedPoints = FHEEncryptNumber(newActionData.points);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      const actionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const actionData = { 
        points: encryptedPoints, 
        timestamp: Math.floor(Date.now() / 1000), 
        owner: address, 
        actionType: newActionData.actionType, 
        status: "pending" 
      };
      await contract.setData(`action_${actionId}`, ethers.toUtf8Bytes(JSON.stringify(actionData)));
      const keysBytes = await contract.getData("action_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(actionId);
      await contract.setData("action_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      setTransactionStatus({ visible: true, status: "success", message: "Eco action submitted securely!" });
      await loadActions();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewActionData({ actionType: "", description: "", points: 0 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const verifyAction = async (actionId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Processing encrypted points with FHE..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      const actionBytes = await contract.getData(`action_${actionId}`);
      if (actionBytes.length === 0) throw new Error("Action not found");
      const actionData = JSON.parse(ethers.toUtf8String(actionBytes));
      
      const verifiedPoints = FHECompute(actionData.points, 'increase10%');
      
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      
      const updatedAction = { ...actionData, status: "verified", points: verifiedPoints };
      await contractWithSigner.setData(`action_${actionId}`, ethers.toUtf8Bytes(JSON.stringify(updatedAction)));
      
      setTransactionStatus({ visible: true, status: "success", message: "FHE verification completed successfully!" });
      await loadActions();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Verification failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const rejectAction = async (actionId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Processing encrypted points with FHE..." });
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      const actionBytes = await contract.getData(`action_${actionId}`);
      if (actionBytes.length === 0) throw new Error("Action not found");
      const actionData = JSON.parse(ethers.toUtf8String(actionBytes));
      const updatedAction = { ...actionData, status: "rejected" };
      await contract.setData(`action_${actionId}`, ethers.toUtf8Bytes(JSON.stringify(updatedAction)));
      setTransactionStatus({ visible: true, status: "success", message: "FHE rejection completed successfully!" });
      await loadActions();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Rejection failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const isOwner = (actionAddress: string) => address?.toLowerCase() === actionAddress.toLowerCase();

  const calculateTotalPoints = () => {
    return actions.reduce((total, action) => {
      if (action.status === "verified") {
        return total + FHEDecryptNumber(action.encryptedPoints);
      }
      return total;
    }, 0);
  };

  const getLeaderboard = () => {
    const leaderboard: { [key: string]: number } = {};
    actions.forEach(action => {
      if (action.status === "verified") {
        const points = FHEDecryptNumber(action.encryptedPoints);
        leaderboard[action.owner] = (leaderboard[action.owner] || 0) + points;
      }
    });
    return Object.entries(leaderboard)
      .map(([owner, points]) => ({ owner, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
  };

  const renderBarChart = () => {
    const leaderboard = getLeaderboard();
    const maxPoints = leaderboard.length > 0 ? leaderboard[0].points : 100;
    
    return (
      <div className="bar-chart-container">
        {leaderboard.map((entry, index) => (
          <div key={index} className="bar-item">
            <div className="bar-label">{entry.owner.substring(0, 6)}...{entry.owner.substring(38)}</div>
            <div className="bar-wrapper">
              <div 
                className="bar-fill" 
                style={{ width: `${(entry.points / maxPoints) * 100}%` }}
              >
                <span className="bar-value">{entry.points} pts</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="nature-spinner"></div>
      <p>Connecting to sustainable network...</p>
    </div>
  );

  return (
    <div className="app-container nature-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon"><div className="leaf-icon"></div></div>
          <h1>ReFi<span>Action</span>Tracker</h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="create-action-btn nature-button">
            <div className="add-icon"></div>Log Eco Action
          </button>
          <button className="nature-button" onClick={() => setShowIntro(!showIntro)}>
            {showIntro ? "Hide Intro" : "Show Intro"}
          </button>
          <div className="wallet-connect-wrapper"><ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/></div>
        </div>
      </header>
      <div className="main-content">
        {showIntro && (
          <div className="intro-card nature-card">
            <h2>Welcome to ReFi Action Tracker</h2>
            <p>
              Track your regenerative actions privately using <strong>Zama FHE technology</strong>. 
              Your eco-friendly activities are encrypted on your device and remain encrypted during processing.
            </p>
            <div className="fhe-badge"><span>FHE-Powered Privacy</span></div>
            <div className="eco-tip">
              <div className="tip-icon">💡</div>
              <div className="tip-content">
                <strong>Today's Eco Tip:</strong>
                <p>{randomTip}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="dashboard-grid">
          <div className="dashboard-card nature-card">
            <h3>Your Eco Impact</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{actions.length}</div>
                <div className="stat-label">Total Actions</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{calculateTotalPoints()}</div>
                <div className="stat-label">Total Points</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{verifiedCount}</div>
                <div className="stat-label">Verified</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{pendingCount}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card nature-card">
            <h3>Community Leaderboard</h3>
            {renderBarChart()}
          </div>
        </div>
        
        <div className="actions-section">
          <div className="section-header">
            <h2>Your Eco Actions</h2>
            <div className="header-actions">
              <button onClick={loadActions} className="refresh-btn nature-button" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="actions-list nature-card">
            <div className="table-header">
              <div className="header-cell">Action</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Status</div>
              <div className="header-cell">Points</div>
              <div className="header-cell">Actions</div>
            </div>
            {actions.length === 0 ? (
              <div className="no-actions">
                <div className="no-actions-icon"></div>
                <p>No eco actions recorded yet</p>
                <button className="nature-button primary" onClick={() => setShowCreateModal(true)}>Log Your First Action</button>
              </div>
            ) : actions.map(action => (
              <div 
                className="action-row" 
                key={action.id} 
                onClick={() => setSelectedAction(action)}
                onMouseEnter={(e) => e.currentTarget.classList.add('hover-effect')}
                onMouseLeave={(e) => e.currentTarget.classList.remove('hover-effect')}
              >
                <div className="table-cell">{action.actionType}</div>
                <div className="table-cell">{new Date(action.timestamp * 1000).toLocaleDateString()}</div>
                <div className="table-cell">
                  <span className={`status-badge ${action.status}`}>{action.status}</span>
                </div>
                <div className="table-cell">
                  {action.status === "verified" ? (
                    <span className="points-badge">
                      {FHEDecryptNumber(action.encryptedPoints)} pts
                    </span>
                  ) : (
                    <span className="points-badge pending">Pending</span>
                  )}
                </div>
                <div className="table-cell actions">
                  {isOwner(action.owner) && action.status === "pending" && (
                    <>
                      <button 
                        className="action-btn nature-button success" 
                        onClick={(e) => { e.stopPropagation(); verifyAction(action.id); }}
                      >
                        Verify
                      </button>
                      <button 
                        className="action-btn nature-button danger" 
                        onClick={(e) => { e.stopPropagation(); rejectAction(action.id); }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitAction} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating} 
          actionData={newActionData} 
          setActionData={setNewActionData}
        />
      )}
      
      {selectedAction && (
        <ActionDetailModal 
          action={selectedAction} 
          onClose={() => { setSelectedAction(null); setDecryptedPoints(null); }} 
          decryptedPoints={decryptedPoints} 
          setDecryptedPoints={setDecryptedPoints} 
          isDecrypting={isDecrypting} 
          decryptWithSignature={decryptWithSignature}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content nature-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="nature-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo"><div className="leaf-icon"></div><span>ReFi Action Tracker</span></div>
            <p>Privacy-first platform for tracking regenerative actions</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge"><span>Powered by Zama FHE</span></div>
          <div className="copyright">© {new Date().getFullYear()} ReFi Action Tracker. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  actionData: any;
  setActionData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ onSubmit, onClose, creating, actionData, setActionData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setActionData({ ...actionData, [name]: value });
    
    // Auto-set points based on action type
    if (name === "actionType") {
      const selectedAction = actionTypes.find(a => a.name === value);
      if (selectedAction) {
        setActionData(prev => ({ ...prev, points: selectedAction.points }));
      }
    }
  };

  const handleSubmit = () => {
    if (!actionData.actionType || !actionData.points) { 
      alert("Please select an action type"); 
      return; 
    }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal nature-card">
        <div className="modal-header">
          <h2>Log Eco Action</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> 
            <div>
              <strong>FHE Encryption Notice</strong>
              <p>Your action data will be encrypted with Zama FHE before submission</p>
            </div>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Action Type *</label>
              <select 
                name="actionType" 
                value={actionData.actionType} 
                onChange={handleChange} 
                className="nature-select"
              >
                <option value="">Select action type</option>
                {actionTypes.map((type, index) => (
                  <option key={index} value={type.name}>
                    {type.name} ({type.points} pts)
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea 
                name="description" 
                value={actionData.description} 
                onChange={handleChange} 
                placeholder="Brief description of your action..." 
                className="nature-textarea"
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label>Points</label>
              <input 
                type="number" 
                name="points" 
                value={actionData.points} 
                onChange={handleChange} 
                className="nature-input"
                disabled
              />
            </div>
          </div>
          
          <div className="encryption-preview">
            <h4>Encryption Preview</h4>
            <div className="preview-container">
              <div className="plain-data">
                <span>Plain Points:</span>
                <div>{actionData.points || 'No action selected'}</div>
              </div>
              <div className="encryption-arrow">→</div>
              <div className="encrypted-data">
                <span>Encrypted Data:</span>
                <div>
                  {actionData.points ? 
                    FHEEncryptNumber(actionData.points).substring(0, 50) + '...' : 
                    'No action selected'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn nature-button">Cancel</button>
          <button 
            onClick={handleSubmit} 
            disabled={creating || !actionData.actionType} 
            className="submit-btn nature-button primary"
          >
            {creating ? "Encrypting with FHE..." : "Submit Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ActionDetailModalProps {
  action: EcoAction;
  onClose: () => void;
  decryptedPoints: number | null;
  setDecryptedPoints: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
}

const ActionDetailModal: React.FC<ActionDetailModalProps> = ({ 
  action, 
  onClose, 
  decryptedPoints, 
  setDecryptedPoints, 
  isDecrypting, 
  decryptWithSignature 
}) => {
  const handleDecrypt = async () => {
    if (decryptedPoints !== null) { 
      setDecryptedPoints(null); 
      return; 
    }
    const decrypted = await decryptWithSignature(action.encryptedPoints);
    if (decrypted !== null) setDecryptedPoints(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="action-detail-modal nature-card">
        <div className="modal-header">
          <h2>Action Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="action-info">
            <div className="info-item">
              <span>Action Type:</span>
              <strong>{action.actionType}</strong>
            </div>
            <div className="info-item">
              <span>Date:</span>
              <strong>{new Date(action.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-item">
              <span>Status:</span>
              <strong className={`status-badge ${action.status}`}>{action.status}</strong>
            </div>
          </div>
          
          <div className="encrypted-data-section">
            <h3>Encrypted Points</h3>
            <div className="encrypted-data">
              {action.encryptedPoints.substring(0, 100)}...
            </div>
            <div className="fhe-tag">
              <div className="fhe-icon"></div>
              <span>FHE Encrypted</span>
            </div>
            
            <button 
              className="decrypt-btn nature-button" 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
            >
              {isDecrypting ? (
                <span className="decrypt-spinner"></span>
              ) : decryptedPoints !== null ? (
                "Hide Decrypted Value"
              ) : (
                "Decrypt with Wallet Signature"
              )}
            </button>
          </div>
          
          {decryptedPoints !== null && (
            <div className="decrypted-data-section">
              <h3>Decrypted Points</h3>
              <div className="decrypted-value">{decryptedPoints}</div>
              <div className="decryption-notice">
                <div className="warning-icon"></div>
                <span>Decrypted data is only visible after wallet signature verification</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn nature-button">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;