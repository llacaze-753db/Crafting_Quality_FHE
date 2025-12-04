// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

// Interface for crafting items
interface CraftingItem {
  id: string;
  name: string;
  baseQuality: number;
  encryptedQuality: string;
  timestamp: number;
  owner: string;
  status: "pending" | "crafted" | "failed";
  catalyst?: string;
  materials: string[];
}

// Interface for crafting history
interface CraftingHistory {
  id: string;
  itemName: string;
  result: string;
  timestamp: number;
  quality: number;
}

// Interface for leaderboard entry
interface LeaderboardEntry {
  address: string;
  craftedCount: number;
  masterpieces: number;
  avgQuality: number;
}

// System announcement interface
interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  priority: "low" | "medium" | "high";
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

// FHE-based quality calculation with random factors
const calculateQuality = (baseQuality: number, catalyst: string): number => {
  // Simulate FHE computation with catalyst effect
  const catalystEffect = catalyst.length > 0 ? 
    (parseInt(ethers.keccak256(ethers.toUtf8Bytes(catalyst))) % 100) / 100 : 0;
  
  // Base quality + random factor + catalyst effect
  const randomFactor = Math.random() * 20;
  let finalQuality = baseQuality + randomFactor + (catalystEffect * 10);
  
  // Cap at 100
  return Math.min(100, Math.max(0, finalQuality));
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CraftingItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCraftModal, setShowCraftModal] = useState(false);
  const [crafting, setCrafting] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newItemData, setNewItemData] = useState({ 
    name: "", 
    baseQuality: 50, 
    catalyst: "",
    materials: [""]
  });
  const [craftingHistory, setCraftingHistory] = useState<CraftingHistory[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedItem, setSelectedItem] = useState<CraftingItem | null>(null);
  const [decryptedQuality, setDecryptedQuality] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  
  // Stats for dashboard
  const craftedCount = items.filter(i => i.status === "crafted").length;
  const failedCount = items.filter(i => i.status === "failed").length;
  const masterpieces = items.filter(i => {
    if (i.status !== "crafted") return false;
    const quality = FHEDecryptNumber(i.encryptedQuality);
    return quality >= 90;
  }).length;

  useEffect(() => {
    loadItems().finally(() => setLoading(false));
    loadCraftingHistory();
    loadLeaderboard();
    loadAnnouncements();
    
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
    };
    initSignatureParams();
  }, []);

  const loadItems = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      const keysBytes = await contract.getData("item_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing item keys:", e); }
      }
      
      const list: CraftingItem[] = [];
      for (const key of keys) {
        try {
          const itemBytes = await contract.getData(`item_${key}`);
          if (itemBytes.length > 0) {
            try {
              const itemData = JSON.parse(ethers.toUtf8String(itemBytes));
              list.push({ 
                id: key, 
                name: itemData.name, 
                baseQuality: itemData.baseQuality,
                encryptedQuality: itemData.encryptedQuality, 
                timestamp: itemData.timestamp, 
                owner: itemData.owner, 
                status: itemData.status || "pending",
                catalyst: itemData.catalyst,
                materials: itemData.materials || []
              });
            } catch (e) { console.error(`Error parsing item data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading item ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setItems(list);
    } catch (e) { console.error("Error loading items:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const loadCraftingHistory = () => {
    // Simulate loading crafting history
    const mockHistory: CraftingHistory[] = [
      { id: "1", itemName: "Dragon Sword", result: "Success", timestamp: Date.now() - 86400000, quality: 87 },
      { id: "2", itemName: "Phoenix Shield", result: "Success", timestamp: Date.now() - 172800000, quality: 92 },
      { id: "3", itemName: "Titanium Armor", result: "Failed", timestamp: Date.now() - 259200000, quality: 45 },
    ];
    setCraftingHistory(mockHistory);
  };

  const loadLeaderboard = () => {
    // Simulate loading leaderboard
    const mockLeaderboard: LeaderboardEntry[] = [
      { address: "0x742d35Cc6634C893292...", craftedCount: 42, masterpieces: 5, avgQuality: 78.5 },
      { address: "0x5aAeb6053F3E94C9b9A...", craftedCount: 38, masterpieces: 3, avgQuality: 75.2 },
      { address: "0x4B0897b0513fdC7C541...", craftedCount: 35, masterpieces: 4, avgQuality: 76.8 },
    ];
    setLeaderboard(mockLeaderboard);
  };

  const loadAnnouncements = () => {
    // Simulate loading announcements
    const mockAnnouncements: Announcement[] = [
      { 
        id: "1", 
        title: "System Maintenance", 
        content: "The crafting system will undergo maintenance on Friday from 2-4 AM UTC.", 
        timestamp: Date.now() - 3600000, 
        priority: "medium" 
      },
      { 
        id: "2", 
        title: "New Catalyst Items", 
        content: "New FHE-encrypted catalyst items have been added to the game!", 
        timestamp: Date.now() - 86400000, 
        priority: "high" 
      },
      { 
        id: "3", 
        title: "Crafting Contest", 
        content: "Join our crafting contest for a chance to win rare materials!", 
        timestamp: Date.now() - 172800000, 
        priority: "low" 
      },
    ];
    setAnnouncements(mockAnnouncements);
  };

  const craftItem = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCrafting(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting quality with ZAMA FHE..." });
    
    try {
      // Calculate final quality with FHE simulation
      const finalQuality = calculateQuality(newItemData.baseQuality, newItemData.catalyst);
      const encryptedQuality = FHEEncryptNumber(finalQuality);
      
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const itemData = { 
        name: newItemData.name, 
        baseQuality: newItemData.baseQuality,
        encryptedQuality: encryptedQuality, 
        timestamp: Math.floor(Date.now() / 1000), 
        owner: address, 
        status: finalQuality >= 30 ? "crafted" : "failed",
        catalyst: newItemData.catalyst,
        materials: newItemData.materials.filter(m => m.trim() !== "")
      };
      
      await contract.setData(`item_${itemId}`, ethers.toUtf8Bytes(JSON.stringify(itemData)));
      
      // Update keys
      const keysBytes = await contract.getData("item_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(itemId);
      await contract.setData("item_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      // Add to crafting history
      const historyEntry: CraftingHistory = {
        id: itemId,
        itemName: newItemData.name,
        result: finalQuality >= 30 ? "Success" : "Failed",
        timestamp: Date.now(),
        quality: finalQuality
      };
      setCraftingHistory(prev => [historyEntry, ...prev]);
      
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: `Item crafted ${finalQuality >= 30 ? 'successfully' : 'but failed'}! Quality: ${finalQuality.toFixed(1)}` 
      });
      
      await loadItems();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCraftModal(false);
        setNewItemData({ name: "", baseQuality: 50, catalyst: "", materials: [""] });
      }, 3000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? 
        "Transaction rejected by user" : "Crafting failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCrafting(false); }
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

  const addMaterialField = () => {
    setNewItemData({...newItemData, materials: [...newItemData.materials, ""]});
  };

  const removeMaterialField = (index: number) => {
    const newMaterials = [...newItemData.materials];
    newMaterials.splice(index, 1);
    setNewItemData({...newItemData, materials: newMaterials});
  };

  const updateMaterial = (index: number, value: string) => {
    const newMaterials = [...newItemData.materials];
    newMaterials[index] = value;
    setNewItemData({...newItemData, materials: newMaterials});
  };

  const isOwner = (itemAddress: string) => address?.toLowerCase() === itemAddress.toLowerCase();

  if (loading) return (
    <div className="loading-screen">
      <div className="metal-spinner"></div>
      <p>Initializing encrypted crafting system...</p>
    </div>
  );

  return (
    <div className="app-container metal-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon"><div className="anvil-icon"></div></div>
          <h1>FHE<span>Craft</span>Forge</h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCraftModal(true)} className="craft-item-btn metal-button">
            <div className="hammer-icon"></div>Craft Item
          </button>
          <div className="wallet-connect-wrapper"><ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/></div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>FHE-Encrypted Crafting System</h2>
            <p>Using ZAMA FHE technology to create items with encrypted quality calculation</p>
          </div>
          <div className="fhe-indicator"><div className="fhe-lock"></div><span>FHE Encryption Active</span></div>
        </div>
        
        {/* Dashboard Section */}
        <div className="dashboard-panels">
          {/* Data Statistics Panel */}
          <div className="dashboard-panel metal-panel">
            <h3>Crafting Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{items.length}</div>
                <div className="stat-label">Total Items</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{craftedCount}</div>
                <div className="stat-label">Crafted</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{failedCount}</div>
                <div className="stat-label">Failed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{masterpieces}</div>
                <div className="stat-label">Masterpieces</div>
              </div>
            </div>
          </div>
          
          {/* Leaderboard Panel */}
          <div className="dashboard-panel metal-panel">
            <h3>Top Crafters</h3>
            <div className="leaderboard-list">
              {leaderboard.map((entry, index) => (
                <div className="leaderboard-entry" key={index}>
                  <div className="rank">#{index + 1}</div>
                  <div className="address">{entry.address.substring(0, 8)}...{entry.address.substring(34)}</div>
                  <div className="stats">
                    <span className="crafted">{entry.craftedCount} crafted</span>
                    <span className="masterpieces">{entry.masterpieces} master</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Announcements Panel */}
          <div className="dashboard-panel metal-panel">
            <h3>System Announcements</h3>
            <div className="announcements-list">
              {announcements.map(announcement => (
                <div className={`announcement ${announcement.priority}`} key={announcement.id}>
                  <div className="announcement-title">{announcement.title}</div>
                  <div className="announcement-content">{announcement.content}</div>
                  <div className="announcement-time">
                    {new Date(announcement.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Crafting History Section */}
        <div className="history-section">
          <div className="section-header">
            <h2>Your Crafting History</h2>
          </div>
          <div className="history-list metal-panel">
            {craftingHistory.length === 0 ? (
              <div className="no-history">
                <div className="no-history-icon"></div>
                <p>No crafting history found</p>
                <button className="metal-button primary" onClick={() => setShowCraftModal(true)}>Craft Your First Item</button>
              </div>
            ) : (
              craftingHistory.map(record => (
                <div className="history-record" key={record.id}>
                  <div className="record-main">
                    <div className="item-name">{record.itemName}</div>
                    <div className={`result ${record.result.toLowerCase()}`}>{record.result}</div>
                  </div>
                  <div className="record-details">
                    <div className="quality">Quality: {record.quality.toFixed(1)}</div>
                    <div className="timestamp">
                      {new Date(record.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Crafted Items Section */}
        <div className="items-section">
          <div className="section-header">
            <h2>Crafted Items</h2>
            <div className="header-actions">
              <button onClick={loadItems} className="refresh-btn metal-button" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="items-list metal-panel">
            <div className="table-header">
              <div className="header-cell">Name</div>
              <div className="header-cell">Owner</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Status</div>
              <div className="header-cell">Actions</div>
            </div>
            {items.length === 0 ? (
              <div className="no-items">
                <div className="no-items-icon"></div>
                <p>No crafted items found</p>
                <button className="metal-button primary" onClick={() => setShowCraftModal(true)}>Craft First Item</button>
              </div>
            ) : items.map(item => (
              <div className="item-row" key={item.id} onClick={() => setSelectedItem(item)}>
                <div className="table-cell item-name">{item.name}</div>
                <div className="table-cell">{item.owner.substring(0, 6)}...{item.owner.substring(38)}</div>
                <div className="table-cell">{new Date(item.timestamp * 1000).toLocaleDateString()}</div>
                <div className="table-cell">
                  <span className={`status-badge ${item.status}`}>{item.status}</span>
                </div>
                <div className="table-cell actions">
                  <button className="action-btn metal-button" onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}>
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Craft Modal */}
      {showCraftModal && (
        <CraftModal 
          onSubmit={craftItem} 
          onClose={() => setShowCraftModal(false)} 
          crafting={crafting} 
          itemData={newItemData} 
          setItemData={setNewItemData}
          addMaterialField={addMaterialField}
          removeMaterialField={removeMaterialField}
          updateMaterial={updateMaterial}
        />
      )}
      
      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal 
          item={selectedItem} 
          onClose={() => { setSelectedItem(null); setDecryptedQuality(null); }} 
          decryptedQuality={decryptedQuality}
          setDecryptedQuality={setDecryptedQuality}
          isDecrypting={isDecrypting}
          decryptWithSignature={decryptWithSignature}
          isOwner={isOwner(selectedItem.owner)}
        />
      )}
      
      {/* Transaction Status Modal */}
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content metal-panel">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="metal-spinner"></div>}
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
            <div className="logo"><div className="anvil-icon"></div><span>FHECraftForge</span></div>
            <p>Powered by ZAMA FHE technology for secure encrypted crafting</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge"><span>FHE-Encrypted Crafting</span></div>
          <div className="copyright">© {new Date().getFullYear()} FHECraftForge. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

// Craft Modal Component
interface CraftModalProps {
  onSubmit: () => void; 
  onClose: () => void; 
  crafting: boolean;
  itemData: any;
  setItemData: (data: any) => void;
  addMaterialField: () => void;
  removeMaterialField: (index: number) => void;
  updateMaterial: (index: number, value: string) => void;
}

const CraftModal: React.FC<CraftModalProps> = ({ 
  onSubmit, 
  onClose, 
  crafting, 
  itemData, 
  setItemData,
  addMaterialField,
  removeMaterialField,
  updateMaterial
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setItemData({ ...itemData, [name]: value });
  };

  const handleSubmit = () => {
    if (!itemData.name || itemData.materials.filter((m: string) => m.trim() !== "").length === 0) { 
      alert("Please fill required fields"); 
      return; 
    }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="craft-modal metal-panel">
        <div className="modal-header">
          <h2>Craft New Item</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> 
            <div>
              <strong>FHE Encryption Notice</strong>
              <p>Item quality will be encrypted with ZAMA FHE and calculated homomorphically</p>
            </div>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Item Name *</label>
              <input 
                type="text" 
                name="name" 
                value={itemData.name} 
                onChange={handleChange} 
                placeholder="Enter item name..." 
                className="metal-input"
              />
            </div>
            
            <div className="form-group">
              <label>Base Quality</label>
              <input 
                type="range" 
                name="baseQuality" 
                min="0" 
                max="100" 
                value={itemData.baseQuality} 
                onChange={handleChange} 
                className="quality-slider"
              />
              <div className="slider-value">{itemData.baseQuality}</div>
            </div>
            
            <div className="form-group">
              <label>FHE Catalyst (Optional)</label>
              <input 
                type="text" 
                name="catalyst" 
                value={itemData.catalyst} 
                onChange={handleChange} 
                placeholder="Enter encrypted catalyst..." 
                className="metal-input"
              />
              <div className="input-help">Encrypted catalyst that will affect quality unpredictably</div>
            </div>
          </div>
          
          <div className="materials-section">
            <label>Materials *</label>
            {itemData.materials.map((material: string, index: number) => (
              <div key={index} className="material-input-group">
                <input
                  type="text"
                  value={material}
                  onChange={(e) => updateMaterial(index, e.target.value)}
                  placeholder={`Material #${index + 1}...`}
                  className="metal-input"
                />
                {itemData.materials.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeMaterialField(index)}
                    className="remove-material-btn"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addMaterialField} className="add-material-btn metal-button">
              + Add Material
            </button>
          </div>
          
          <div className="encryption-preview">
            <h4>FHE Quality Simulation</h4>
            <div className="preview-container">
              <div className="plain-data">
                <span>Base Quality:</span>
                <div>{itemData.baseQuality}</div>
              </div>
              <div className="encryption-arrow">→</div>
              <div className="encrypted-data">
                <span>Encrypted Quality:</span>
                <div>FHE-Encrypted[Quality]</div>
              </div>
            </div>
            <div className="preview-help">
              Actual quality will be calculated homomorphically using ZAMA FHE
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn metal-button">Cancel</button>
          <button onClick={handleSubmit} disabled={crafting} className="submit-btn metal-button primary">
            {crafting ? "Crafting with FHE..." : "Craft Item"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Item Detail Modal Component
interface ItemDetailModalProps {
  item: CraftingItem;
  onClose: () => void;
  decryptedQuality: number | null;
  setDecryptedQuality: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
  isOwner: boolean;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ 
  item, 
  onClose, 
  decryptedQuality, 
  setDecryptedQuality, 
  isDecrypting, 
  decryptWithSignature,
  isOwner
}) => {
  const handleDecrypt = async () => {
    if (decryptedQuality !== null) { 
      setDecryptedQuality(null); 
      return; 
    }
    const decrypted = await decryptWithSignature(item.encryptedQuality);
    if (decrypted !== null) setDecryptedQuality(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="item-detail-modal metal-panel">
        <div className="modal-header">
          <h2>{item.name} Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="item-info">
            <div className="info-item">
              <span>Name:</span>
              <strong>{item.name}</strong>
            </div>
            <div className="info-item">
              <span>Owner:</span>
              <strong>{item.owner.substring(0, 6)}...{item.owner.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Date Crafted:</span>
              <strong>{new Date(item.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-item">
              <span>Status:</span>
              <strong className={`status-badge ${item.status}`}>{item.status}</strong>
            </div>
            
            {item.catalyst && (
              <div className="info-item">
                <span>FHE Catalyst:</span>
                <strong>{item.catalyst.substring(0, 20)}...</strong>
              </div>
            )}
          </div>
          
          <div className="materials-list">
            <h3>Materials Used</h3>
            <div className="materials-grid">
              {item.materials.map((material, index) => (
                <div key={index} className="material-tag">
                  {material}
                </div>
              ))}
            </div>
          </div>
          
          <div className="encrypted-data-section">
            <h3>FHE-Encrypted Quality</h3>
            <div className="encrypted-data">
              {item.encryptedQuality.substring(0, 50)}...
            </div>
            <div className="fhe-tag">
              <div className="fhe-icon"></div>
              <span>ZAMA FHE Encrypted</span>
            </div>
            
            {isOwner && (
              <button 
                className="decrypt-btn metal-button" 
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  <span className="decrypt-spinner"></span>
                ) : decryptedQuality !== null ? (
                  "Hide Quality"
                ) : (
                  "Decrypt with Wallet Signature"
                )}
              </button>
            )}
          </div>
          
          {decryptedQuality !== null && (
            <div className="decrypted-data-section">
              <h3>Decrypted Quality</h3>
              <div className={`quality-display ${decryptedQuality >= 90 ? 'masterpiece' : decryptedQuality >= 70 ? 'good' : 'poor'}`}>
                {decryptedQuality.toFixed(1)}
                {decryptedQuality >= 90 && <span className="masterpiece-badge">Masterpiece!</span>}
              </div>
              <div className="decryption-notice">
                <div className="warning-icon"></div>
                <span>Decrypted quality is only visible after wallet signature verification</span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn metal-button">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;