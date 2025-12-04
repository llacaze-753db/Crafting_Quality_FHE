# Encrypted Crafting Adventure: A FHE-based RPG

Unleash your creativity in the world of **Encrypted Crafting Adventure**, where player-driven gear creation meets the cutting-edge security of **Zama's Fully Homomorphic Encryption technology**. This immersive RPG allows players to craft unique equipment using traditional materials and FHE-encrypted inspirations, adding an element of surprise and unpredictability to creation that enhances the gaming experience.

## The Challenge of Crafting in RPGs

In many role-playing games (RPGs), crafting can often feel stagnant and predictable—players are limited to a fixed set of recipes without the freedom to experiment or infuse personal flair into their creations. Furthermore, the lack of security surrounding crafting ingredients and outcomes raises concerns about authenticity and ownership among players. 

## Enter FHE: A Game-Changer

**Zama's Fully Homomorphic Encryption (FHE)** transforms the crafting landscape by allowing players to incorporate encrypted "inspirations" or "recipes" during crafting. This revolutionary technology ensures that even while the crafting process computes results based on hidden inputs, the outcomes remain confidential and secure. Implemented using Zama's open-source libraries—such as **Concrete** and the **zama-fhe SDK**—this system guarantees that players can innovate freely while maintaining the integrity of their materials.

## Core Features

🔧 **Catalyst Effects**: Players can add FHE-encrypted inspirations to crafting. The effects of these catalysts influence the quality of the final product in a homomorphic manner, meaning the results can vary with each attempt, adding an exciting element of surprise.

🎲 **Luck & Masterpieces**: Our system introduces luck into crafting outcomes, encouraging players to experiment with different combinations. Occasionally, a player might create a "Masterpiece"—a rare item of exceptional quality.

🛠️ **Engaging User Interface**: A user-friendly crafting interface that guides players through adding materials and inspirations, making it accessible to both new and experienced players.

🌍 **Sandbox Environment**: Explore a sandbox-style world where players can gather resources, trade, and collaborate with others to craft unique items, fostering a thriving community of creators.

## Technology Stack

- **Zama FHE SDK**: The primary technology for confidential computing and homomorphic encryption.
- **Concrete**: Zama's library for efficient computation on encrypted data.
- **Node.js**: The JavaScript runtime environment for building scalable network applications.
- **Hardhat**: A development environment to compile, deploy, test, and debug Ethereum software.

## Directory Structure

Here’s a glimpse of the project’s directory structure:

```
Encrypted-Crafting-Adventure/
│
├── contracts/
│   └── Crafting_Quality_FHE.sol
│
├── src/
│   ├── app.js
│   ├── crafting.js
│   └── userInterface.js
│
├── tests/
│   └── crafting.test.js
│
├── package.json
└── README.md
```

## Installation Guide

To get started with **Encrypted Crafting Adventure**, follow these setup instructions after downloading the project:

1. Ensure you have **Node.js** installed on your machine. You can download it from the official site.
2. Install **Hardhat** globally by running:
   ```bash
   npm install -g hardhat
   ```
3. Navigate to the project directory using your terminal.
4. Execute the following command to install the necessary dependencies, including Zama's FHE libraries:
   ```bash
   npm install
   ```
5. Ensure that all dependencies are properly installed without errors.

## Build & Run Guide

After installation, you can compile and run the project easily. Use the following commands:

1. To compile the smart contracts, run:
   ```bash
   npx hardhat compile
   ```
2. To execute the tests, run:
   ```bash
   npx hardhat test
   ```
3. To deploy to a local Ethereum network, start by running:
   ```bash
   npx hardhat node
   ```
4. Run the deploy script in another terminal:
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

## Example Code Snippet

Here’s a simplified example demonstrating how a player might use the crafting function with FHE:

```javascript
const { Crafting } = require('./crafting');

async function createItem(materials, encryptedInspiration) {
    try {
        const craftedItem = await Crafting.craft(materials, encryptedInspiration);
        console.log(`Crafted Item: ${craftedItem.name} | Quality: ${craftedItem.quality}`);
    } catch (error) {
        console.error("Error during crafting:", error);
    }
}

// Invocation
createItem(['Iron Ore', 'Leather'], 'FHE_Encrypted_Inspiration');
```

This code snippet illustrates how players can craft items by passing materials and encrypted inspirations into the crafting function, showcasing the project's core functionality.

## Acknowledgements

### Powered by Zama

We extend our gratitude to the Zama team for their pioneering work and open-source tools that enable confidential blockchain applications. Their innovations in fully homomorphic encryption empower projects like **Encrypted Crafting Adventure**, allowing us to redefine the crafting experience in RPGs. 

Join us in this exciting journey where creativity and technology collide, making every crafted item a unique adventure!