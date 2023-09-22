const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');

const ethers = require("ethers");
const ADDRESS = require("./contracts/Adress");
const ABI = require("./contracts/ABI");

const app = express();
const port = process.env.PORT || 3001;

// Create a SQLite database connection
const db = new sqlite3.Database('mydb.sqlite');

// Create a table to store your data
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)');

  db.run(` 

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
        

  `)

});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const network = "goerli";
const provider = new ethers.providers.InfuraProvider(
	network,
	process.env.INFURA_KEY
);

async function getData() {
    const BaseXContract = new ethers.Contract(ADDRESS, ABI, provider);
    const itemsContract = await BaseXContract.getItems();
    console.log(itemsContract)
}

(async () => {
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
