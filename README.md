# ReFi_Action_Tracker_Fhe

ReFi Action Tracker is an innovative platform designed to privately track and reward individual regenerative actions, powered by **Zama's Fully Homomorphic Encryption technology**. This platform allows users to securely document their eco-friendly behaviors—such as recycling and using public transport—through their mobile devices. It transforms these actions into “Regenerative Points” that can be redeemed for rewards or incorporated into Decentralized Identifiers (DIDs).

## Understanding the Challenge 🌍

Individuals today are more conscious than ever of their environmental impact, yet they often lack the means to track or be rewarded for their sustainable actions. Traditional tracking mechanisms can expose personal data, leading to privacy concerns. Furthermore, without proper incentives, many feel disheartened in their journey towards sustainable living. There is a pressing need for a solution that not only respects user privacy but also encourages eco-friendly behaviors through tangible rewards.

## How FHE Addresses This Issue 🔒

Our platform tackles these challenges through **Fully Homomorphic Encryption (FHE)**, which allows for computations to be performed on encrypted data without needing to decrypt it first. This means that users can confidently log their environmentally friendly actions without fearing for their privacy. 

Implemented using **Zama's open-source libraries**, including the **zama-fhe SDK**, we can perform homomorphic calculations on the users' encrypted data to convert their sustainable actions into Regenerative Points. These points can then be utilized for various rewards, thus incentivizing users to adopt a greener lifestyle while ensuring their data remains confidential.

## Core Functionalities 🌟

- **Encrypted Tracking**: Log eco-friendly actions securely with FHE, ensuring user data is always private.
- **Regenerative Points Calculation**: Earn points through homomorphic computations, seamlessly transforming actions into rewards.
- **Privacy-Preserving Incentives**: Users are motivated to participate in sustainable activities without compromising their personal information.
- **Personalized Dashboard**: A user-friendly interface that displays your environmental actions and tasks.

## Technology Stack ⚙️

- **Zama FHE SDK**: For confidential computing and secure data handling.
- **Node.js**: A JavaScript runtime for building scalable applications.
- **Hardhat/Foundry**: Development environments for Ethereum smart contracts.
- **Solidity**: The programming language for writing smart contracts.

## Directory Structure 📂

Below is the structure of the project, showcasing the key components:

```
/ReFi_Action_Tracker_Fhe
│
├── contracts
│   └── ReFi_Action_Tracker.sol
│
├── scripts
│   └── deploy.js
│
├── test
│   └── ReFi_Action_Tracker.test.js
│
├── package.json
├── hardhat.config.js
└── README.md
```

## Setup Instructions 🚀

To get started with the ReFi Action Tracker, follow these steps:

1. Ensure you have [Node.js](https://nodejs.org/) installed.
2. Install Hardhat or Foundry as your development environment.
3. Download the project files from your preferred source.
4. Navigate to the project directory in your terminal.
5. Run the following command to install all the necessary dependencies including the Zama FHE libraries:

   ```bash
   npm install
   ```

**Note**: Please refrain from using `git clone` or any other URLs to obtain the project files.

## Compile, Test, and Run 🛠️

Once the setup is complete, you can compile and test the smart contracts as follows:

1. **Compile the contracts**:
   
   ```bash
   npx hardhat compile
   ```

2. **Run the tests** to ensure everything works as expected:

   ```bash
   npx hardhat test
   ```

3. **Deploy the contracts** to your chosen network:

   ```bash
   npx hardhat run scripts/deploy.js --network [your_network]
   ```

## Example Usage 🔧

Here's an example of how you can use the platform to accomplish a task within the ecosystem:

```javascript
const { ReFiActionTracker } = require('./ReFi_Action_Tracker.sol');

async function logAction(userId, actionType) {
    const actionData = encryptAction(userId, actionType); // Encrypt the action data using FHE
    const pointsEarned = await ReFiActionTracker.calculatePoints(actionData); // Calculate points homomorphically
    console.log(`User ${userId} has earned ${pointsEarned} points for their ${actionType}!`);
}

// Simulate logging an eco-friendly action
logAction("user123", "recycling");
```

## Acknowledgements 🙏

This project is made possible thanks to the pioneering efforts of the Zama team and their open-source tools, which empower developers to create confidential blockchain applications. Their commitment to privacy and security has enabled us to build a platform that encourages sustainable living while preserving user anonymity.

---

Join us in this eco-friendly journey and help foster a greener future!
