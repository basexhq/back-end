const express = require('express');
const sqlite3 = require('sqlite3');
const { promisify } = require('util');
const axios = require("axios");

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

const SQL_IPFS_exists = `SELECT COUNT(*) FROM JSONIPFS WHERE ipfs = ?`;
const SQL_IPFS_insert = `INSERT INTO JSONIPFS (ipfs, json) VALUES (?, ?)`;

const ABI_events = [
  "event OrganisationAddedToKleros(string orgGuid, string name, address klerosAddress)",
  "event ItemAdded(string orgGuid, string orgName, string itemGuid, uint itemIndex, string itemName, string itemJSONIPFS)",
];

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const network = "goerli";
const provider = new ethers.providers.InfuraProvider(
	network,
	process.env.INFURA_KEY
);

const BaseXContract = new ethers.Contract(ADDRESS, ABI, provider);
const BaseXContractEvents = new ethers.Contract(ADDRESS, ABI_events, provider);

// TODO: add PVT NVT to remove the need to fetch a new one
BaseXContractEvents.on("ItemAdded", async (orgGuid, orgName, itemGuid, itemIndex, itemName, JSONIPFS, event) => {
  console.log(event)

  let item = await BaseXContract.getItem(itemIndex); // TODO: once we have PVT NVT we can skip this entirely

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
        // console.log('Data processed successfully');
      }
    }
  );

});

async function getData() {

    const itemsContract = await BaseXContract.getItems();
    // console.log(itemsContract)

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
            // console.log('Data processed successfully: ' + itemsContract[i].itemGuid);
          }
        }
      );
    }

}

(async () => {
  await dbExecAsync(createTablesSQL);
  await getData();
})();


async function fetchIPFSfromKleros(JSONIPFS) {

}

const JSONIPFS = `QmSbjVoTeYu55yWvCu5EaXggemz48pCpVjEHS8zW9wbrBy`;



db.get(SQL_IPFS_exists, [JSONIPFS], (err, row) => {
  if (err) {
    console.error(err.message);
  } else {
    const count = row['COUNT(*)'];
    if (count === 1) {
      console.log(`IPFS hash ${JSONIPFS} exists in the table.`);
    } else {
      console.log(`IPFS hash ${JSONIPFS} does not exist in the table.`);

      axios
      .get(`https://ipfs.kleros.io/ipfs/${JSONIPFS}`)
      .then((response) => {
        const data = response.data;
    
        db.run(SQL_IPFS_insert, [JSONIPFS, JSON.stringify(data)], function(err) {
          if (err) {
            console.error(err.message);
          } else {
            console.log(`Record inserted with ID: ${this.lastID}`);
          }
        });
    
      }).catch((error) => {
        console.log(error);
    
        return Promise.resolve({
          error: true,
          message: "An error occurred while fetching or processing data",
          errorDetails: error,
        });
      });


    }
  }
});






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
