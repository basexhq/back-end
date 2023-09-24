const express = require('express');
const sqlite3 = require('sqlite3');
const { promisify } = require('util');


const bodyParser = require('body-parser');


const ethers = require("ethers");
const ADDRESS = require("./contracts/Adress");
const ABI = require("./contracts/ABI");

const app = express();
const port = process.env.PORT || 3001;

// Create a SQLite database connection
const db = new sqlite3.Database('mydb.sqlite');
const dbExecAsync = promisify(db.exec.bind(db));


const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS Organisation (
        orgGuid TEXT PRIMARY KEY,
        name TEXT,
        JSONIPFS TEXT,
        klerosAddress TEXT,
        payoutWallet TEXT,
        PVT INTEGER,
        NVT INTEGER,
        PVThistorical INTEGER,
        NVThistorical INTEGER
    );

    CREATE TABLE IF NOT EXISTS Items (
        itemGuid TEXT PRIMARY KEY,
        targetGuid TEXT,
        orgIndex INTEGER,
        JSONIPFS TEXT,
        PVT INTEGER,
        NVT INTEGER,
        approvedToKlerosAndTokensMinted BOOLEAN
    );

    CREATE TABLE IF NOT EXISTS JSONIPFS (
        ipfs TEXT PRIMARY KEY,
        json TEXT
    );
`;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const network = "goerli";
const provider = new ethers.providers.InfuraProvider(
	network,
	process.env.INFURA_KEY
);

const BaseXContract = new ethers.Contract(ADDRESS, ABI, provider);

BaseXContract.on("ItemAdded", async (eventData) => {
  console.log("Event Name:", eventData.event);
  console.log("Block Number:", eventData.blockNumber);
  console.log("Transaction Hash:", eventData.transactionHash);

  // Access the event parameters
  const orgGuid = eventData.args.orgGuid;
  const orgName = eventData.args.orgName;
  const itemGuid = eventData.args.itemGuid;
  const jsonIPFS = eventData.args.jsonIPFS;

  console.log("orgGuid:", orgGuid);
  console.log("orgName:", orgName);
  console.log("itemGuid:", itemGuid);
  console.log("jsonIPFS:", jsonIPFS);

  let itemIndex = await BaseXContract.itemGuidToIndex(itemGuid);

  let item = await BaseXContract.getItem(itemIndex);

  console.log(item);

  db.run(
    'INSERT OR IGNORE INTO Items (itemGuid, targetGuid, orgIndex, JSONIPFS, PVT, NVT, approvedToKlerosAndTokensMinted) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      item.itemGuid,
      item.targetGuid,
      item.orgIndex.toNumber(),
      item.JSONIPFS,
      item.PVT.toNumber(),
      item.NVT.toNumber(),
      item.approvedToKlerosAndTokensMinted
    ],
    function (err) {
      if (err) {
        console.error('Error inserting data:', err);
      } else {
        console.log('Data processed successfully: ' + itemsContract[i].itemGuid);
      }
    }
  );

});

async function getData() {

    const itemsContract = await BaseXContract.getItems();
    console.log(itemsContract)

    for (let i = 0; i < itemsContract.length; i++) {
      db.run(
        'INSERT OR IGNORE INTO Items (itemGuid, targetGuid, orgIndex, JSONIPFS, PVT, NVT, approvedToKlerosAndTokensMinted) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          itemsContract[i].itemGuid,
          itemsContract[i].targetGuid,
          itemsContract[i].orgIndex.toNumber(),
          itemsContract[i].JSONIPFS,
          itemsContract[i].PVT.toNumber(),
          itemsContract[i].NVT.toNumber(),
          itemsContract[i].approvedToKlerosAndTokensMinted
        ],
        function (err) {
          if (err) {
            console.error('Error inserting data:', err);
          } else {
            console.log('Data processed successfully: ' + itemsContract[i].itemGuid);
          }
        }
      );
    }

}

(async () => {

  await dbExecAsync(createTablesSQL);

  await getData();



})();





// Get all items
app.get('/items', (req, res) => {
  db.all('SELECT * FROM items', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ items: rows });
  });
});

// Add a new item
app.post('/items', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  db.run('INSERT INTO items (name) VALUES (?)', name, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});