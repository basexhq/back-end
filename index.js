const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { promisify } = require('util');
const axios = require("axios");
const bodyParser = require('body-parser');
const ethers = require("ethers");
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const port = process.env.PORT || 3000;

// FYI: By default we use prod ---> `staging = false` ---> when passing additional flag "true" it means staging.

const ADDRESS_prod    = require("./contracts/Address-prod");
const ADDRESS_staging = require("./contracts/Address-staging");

const ABI_prod    = require("./contracts/ABI-prod");
const ABI_staging = require("./contracts/ABI-staging");

// Some quirky issue: https://github.com/ethers-io/ethers.js/discussions/4387 (hard to tell why it is required, a dedicated format for events)
const ABI_events_prod = [
  "event OrganisationAddedToKleros(string orgGuid, string name, address klerosAddress)",
  "event ItemAdded(string orgGuid, string orgName, string itemGuid, uint itemIndex, string itemName, string itemJSONIPFS, uint PVT, uint NVT)"
];
const ABI_events_staging = [ // YAGNI vs consistency ---> consistency wins :) (currently both versions of the events are the same, may change in the future)
  "event OrganisationAddedToKleros(string orgGuid, string name, address klerosAddress)",
  "event ItemAdded(string orgGuid, string orgName, string itemGuid, uint itemIndex, string itemName, string itemJSONIPFS, uint PVT, uint NVT)"
];

const network = "goerli";
const provider = new ethers.providers.InfuraProvider(
	network,
	process.env.INFURA_KEY
);

const BaseXContract_prod       = new ethers.Contract(ADDRESS_prod, ABI_prod, provider);
const BaseXContractEvents_prod = new ethers.Contract(ADDRESS_prod, ABI_events_prod, provider);

const BaseXContract_staging       = new ethers.Contract(ADDRESS_staging, ABI_staging, provider);
const BaseXContractEvents_staging = new ethers.Contract(ADDRESS_staging, ABI_events_staging, provider);

const db_prod    = new sqlite3.Database('data_prod.sqlite');
const db_staging = new sqlite3.Database('data_staging.sqlite');

const dbExecAsync_prod    = promisify(db_prod.exec.bind(db_prod)); // For chaining DB operation as promises
const dbExecAsync_staging = promisify(db_staging.exec.bind(db_staging));

const SQL_create_table = `
    CREATE TABLE IF NOT EXISTS Organisations (
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

const SQL_IPFS_get = `SELECT json FROM JSONIPFS WHERE ipfs = ?`;
const SQL_IPFS_insert = `INSERT INTO JSONIPFS (ipfs, json) VALUES (?, ?)`;

const SQL_query_evaluations = `
  SELECT Items.*, JSONIPFS.json
  FROM Items
  LEFT JOIN Organisations ON Items.targetGuid = Organisations.orgGuid
  LEFT JOIN JSONIPFS ON Items.JSONIPFS = JSONIPFS.ipfs
  WHERE Organisations.orgGuid IS NULL;
`;

const SQL_query_reports = `
  SELECT Items.*, JSONIPFS.json
  FROM Items
  INNER JOIN Organisations ON Items.targetGuid = Organisations.orgGuid
  LEFT JOIN JSONIPFS ON Items.JSONIPFS = JSONIPFS.ipfs;
`;

const SQL_organisations = `SELECT * FROM Organisations;`;


// TODO: add PVT NVT to remove the need to fetch a new one
BaseXContractEvents_prod.on("ItemAdded", async (orgGuid, orgName, itemGuid, itemIndex, itemName, JSONIPFS, PVT, NVT, event) => {
  console.log("Event listener ---> ItemAdded ---> itemGuid ---> " + itemGuid);
  let item = await BaseXContract_prod.getItem(itemIndex); // TODO: once we have PVT NVT we can skip this entirely BUT maybe just keep it for now
  _saveItemToDB_fetchIPFS(item.itemGuid, item.targetGuid, item.orgIndex.toNumber(), item.JSONIPFS, item.PVT.toNumber(), item.NVT.toNumber(), item.approvedToKlerosAndTokensMinted);
});
BaseXContractEvents_staging.on("ItemAdded", async (orgGuid, orgName, itemGuid, itemIndex, itemName, JSONIPFS, PVT, NVT, event) => {
  console.log("Event listener ---> ItemAdded ---> itemGuid ---> " + itemGuid);
  let item = await BaseXContract_prod.getItem(itemIndex); // TODO: once we have PVT NVT we can skip this entirely BUT maybe just keep it for now
  _saveItemToDB_fetchIPFS(item.itemGuid, item.targetGuid, item.orgIndex.toNumber(), item.JSONIPFS, item.PVT.toNumber(), item.NVT.toNumber(), item.approvedToKlerosAndTokensMinted);
});

async function initialLoad_processItems() {

    const itemsContract = await BaseXContract.getItems();
    // console.log(itemsContract)

    for (let i = 0; i < itemsContract.length; i++) {
      _saveItemToDB_fetchIPFS(itemsContract[i].itemGuid, itemsContract[i].targetGuid, itemsContract[i].orgIndex.toNumber(), itemsContract[i].JSONIPFS, itemsContract[i].PVT.toNumber(), itemsContract[i].NVT.toNumber(), itemsContract[i].approvedToKlerosAndTokensMinted);
    }
}

function _saveItemToDB_fetchIPFS(itemGuid, targetGuid, orgIndex, JSONIPFS, PVT, NVT, approvedToKlerosAndTokensMinted) {
  db.run(
    'INSERT OR IGNORE INTO Items (itemGuid, targetGuid, orgIndex, JSONIPFS, PVT, NVT, approvedToKlerosAndTokensMinted) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [itemGuid, targetGuid, orgIndex, JSONIPFS.replace("/ipfs/", ""), PVT, NVT, approvedToKlerosAndTokensMinted],
    function (err) {
      if (err) {
        console.error('Error inserting data:', err);
      } else {
        // console.log('Data processed successfully: ' + itemsContract[i].itemGuid);
      }
    }
  );

  fetchIPFS(JSONIPFS.replace("/ipfs/", "").replace("{", "").replace("}", "")); // Annoying Kleros formatting + me messing with one item (removing {} curly braces)
}

// Could be either database or IPFS (and then save to database)
async function fetchIPFS(hash) {
  
  return new Promise((resolve, reject) => {

    db.get(SQL_IPFS_get, [hash], (err, row) => {
      if (err) {
        console.error(err.message);
      } else {

        if (row) {
          console.log(`IPFS hash ${hash} already exists in the DB.`);
          resolve(row.json);
        } else {
          console.log(`IPFS hash ${hash} does not exist in the DB, making a GET request to Kleros IPFS node.`);
    
          axios
          .get(`https://ipfs.kleros.io/ipfs/${hash}`)
          .then((response) => {
            const data = response.data.values; // NOTE: we save only VALUES (not colums, columns are static, saving some space)

            resolve(data); // item not found in DB, returning from IPFS and saving to DB
        
            db.run(SQL_IPFS_insert, [hash, JSON.stringify(data)], function(err) {
              if (err) {
                console.error(err.message);
              } else {
                console.log(`IPFS saved: ${hash}`);
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
  });
}

async function initialLoad_processOrganisations() {
  const orgsContract = await BaseXContract.getOrganisations();
  for (let i = 0; i < orgsContract.length; i++) {

    if (!orgsContract[i].JSONIPFS) {
      console.log("Organisation " + orgsContract[i].orgGuid + " ---> " + orgsContract[i].name + " hasn't been added to Kleros yet, skipping...");
    } else {
      _saveOrganisationToDB(orgsContract[i].orgGuid, orgsContract[i].name, orgsContract[i].JSONIPFS.replace("/ipfs/", ""), orgsContract[i].klerosAddress, orgsContract[i].payoutWallet, orgsContract[i].PVT.toNumber(), orgsContract[i].NVT.toNumber(), orgsContract[i].PVThistorical.toNumber(), orgsContract[i].NVThistorical.toNumber());
    }

  }
}

BaseXContractEvents_prod.on("OrganisationAddedToKleros", async (orgGuid, name, klerosAddress, event) => {
  console.log("Event listener ---> OrganisationAddedToKleros ---> " + orgGuid);
  let orgIndex = await BaseXContract_prod.orgGuidToIndex(orgGuid);
  let org = await BaseXContract_prod.getOrganisation(orgIndex);
  _saveOrganisationToDB(org.orgGuid, org.name, org.JSONIPFS.replace("/ipfs/", ""), org.klerosAddress, org.payoutWallet, org.PVT.toNumber(), org.NVT.toNumber(), org.PVThistorical.toNumber(), org.NVThistorical.toNumber());
});
BaseXContractEvents_staging.on("OrganisationAddedToKleros", async (orgGuid, name, klerosAddress, event) => {
  console.log("Event listener ---> OrganisationAddedToKleros ---> " + orgGuid);
  let orgIndex = await BaseXContract_staging.orgGuidToIndex(orgGuid);
  let org = await BaseXContract_staging.getOrganisation(orgIndex);
  _saveOrganisationToDB(org.orgGuid, org.name, org.JSONIPFS.replace("/ipfs/", ""), org.klerosAddress, org.payoutWallet, org.PVT.toNumber(), org.NVT.toNumber(), org.PVThistorical.toNumber(), org.NVThistorical.toNumber(), true);
});

function _saveOrganisationToDB(orgGuid, name, JSONIPFS, klerosAddress, payoutWallet, PVT, NVT, PVThistorical, NVThistorical, staging = false) {

  const db = staging ? db_staging : db_prod;

  db.run(
    'INSERT OR IGNORE INTO Organisations (orgGuid, name, JSONIPFS, klerosAddress, payoutWallet, PVT, NVT, PVThistorical, NVThistorical) VALUES (?, ?, ? ,? ,? ,? ,? ,? ,?)',
    [orgGuid, name, JSONIPFS, klerosAddress, payoutWallet, PVT, NVT, PVThistorical, NVThistorical],
    function (err) {
      if (err) {
        console.error('Error inserting data:', err);
      } else {
        console.log('Org ---> data processed successfully: ' + orgGuid + " ---> " + name);
      }
    }
  );
};

(async () => {
  await dbExecAsync_prod(SQL_create_table);
  await dbExecAsync_staging(SQL_create_table);
  await initialLoad_processItems();
  await initialLoad_processOrganisations();
})();

app.get("/reports", async (req, res) => {
	const reportItems = await grabReports();
	res.json(reportItems);
});
app.get("/reports_staging", async (req, res) => {
	const reportItems = await grabReports(true);
	res.json(reportItems);
});

app.get("/evaluations", async (req, res) => {
	const evaluationItems = await grabEvaluations();
	res.json(evaluationItems);
});

app.get("/evaluations_staging", async (req, res) => {
	const evaluationItems = await grabEvaluations(true);
	res.json(evaluationItems);
});

app.get("/organisations", async (req, res) => {
	const organisations = await grabOrganisations();
	res.json(organisations);
});

app.get("/organisations_staging", async (req, res) => {
	const organisations = await grabOrganisations(true);
	res.json(organisations);
});

async function grabEvaluations(staging = false) {
  return new Promise((resolve, reject) => {
    const evaluations = []; // we create array of promises to ensure all items are processed before resolving

    const db = staging ? db_staging : db_prod;
    db.all(SQL_query_evaluations, [], (err, rows) => {
      if (err) {
        console.error(err.message);
        reject(err);
        return;
      }

      const promises = rows.map((row) => {
        return new Promise((resolveRow, rejectRow) => {
          if (!row.json) {
            console.log("Grab evaluations: No JSON for item: " + row.itemGuid);
            resolveRow(null); // Resolve with null for items with no JSON
            return;
          }

          const evalData = JSON.parse(row.json);

          const newEvaluation = {
            organisationGUID: "",
            GUID: `${evalData.GUID}`,
            title: `${evalData.Title}`,
            evaluationContent: {
              comments: evalData.Comments,
              planetJustifications: [],
            },
            pvt: Number(evalData["Positive Value"] ?? 0),
            nvt: Number(evalData["Negative Value"] ?? 0),
            uploadDate: new Date(evalData["Start Date"]),
            accountingPeriodStart: new Date(evalData["Start Date"]),
            accountingPeriodEnd: new Date(evalData["End Date"]),
            targetGUID: evalData["GUID Target"],
          };

          for (let i = 1; i <= 17; i++) {
            const sdgValueKey = `SDG${i} Value`;
            const sdgCommentKey = `SDG${i} Comment`;

            if (evalData[sdgValueKey] || evalData[sdgCommentKey]) {
              newEvaluation.evaluationContent.planetJustifications.push({
                comment: evalData[sdgCommentKey],
                percentage: parseFloat(evalData[sdgValueKey]),
                planetImage: `/img/sdg${i}.png`,
              });
            }
          }

          evaluations.push(newEvaluation);
          resolveRow(newEvaluation);
        });
      });

      Promise.all(promises)
        .then(() => {
          resolve(evaluations.filter(x => x)); // Some rows that resolved with null (no JSON) are filtered out
        })
        .catch((error) => {
          reject(error);
        });
    });
  });
}

async function grabReports(staging = false) {
  return new Promise((resolve, reject) => {
    const evaluations = []; // we create array of promises to ensure all items are processed before resolving

    const db = staging ? db_staging : db_prod;
    db.all(SQL_query_reports, [], (err, rows) => {
      if (err) {
        console.error(err.message);
        reject(err);
        return;
      }

      const promises = rows.map((row) => {
        return new Promise((resolveRow, rejectRow) => {

          if (!row.json) {
            console.log("Grab reports: No JSON for item: " + row.itemGuid);
            resolveRow(null); // Resolve with null for items with no JSON
            return;
          }

          const reportData = JSON.parse(row.json);

          const newReport = {
						organisationGUID: row.targetGuid, // These two come from on-chain (kept in table)
            reportGUID: row.itemGuid,

						title: reportData.Title, // These below come from IPFS
						comments: reportData.Comments,
						uploadDate: new Date(reportData["Start Date"]),
						accountingPeriodStart: new Date(reportData["Start Date"]),
						accountingPeriodEnd: new Date(reportData["End Date"]),
						source: reportData.Source,
						ipfs: reportData.Report,
					};

          evaluations.push(newReport);
          resolveRow(newReport);
        });
      });

      Promise.all(promises)
        .then(() => {
          resolve(evaluations.filter(x => x)); // Some rows that resolved with null (no JSON) are filtered out
        })
        .catch((error) => {
          reject(error);
        });
    });
  });
}

async function grabOrganisations(staging = false) {

  return new Promise((resolve, reject) => {
    const db = staging ? db_staging : db_prod;
    db.all(SQL_organisations, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// STARTING THE APP

app.get("/", (req, res) => {
	res.send("GM! /reports /evaluations /organisations /reports_staging /evaluations_staging /organisations_staging");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
