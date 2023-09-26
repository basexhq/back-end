const express = require("express");
const cors = require('cors');
const ethers = require("ethers");
const ADDRESS = require("./contracts/Adress");
const ABI = require("./contracts/ABI");
const grabEvaluations = require("./items/grabEvaluations");
const grabReports = require("./items/grabReports");
require("dotenv").config();

const app = express();
app.use(cors()); // dummy commit, push deploy, push 3

const network = "goerli";
const provider = new ethers.providers.InfuraProvider(
	network,
	process.env.INFURA_KEY
);

const BaseXContract = new ethers.Contract(ADDRESS, ABI, provider);

app.get("/", (req, res) => {
	res.send("GM!");
});

app.get("/evaluations", async (req, res) => {
	const evaluationItems = await grabEvaluations(BaseXContract);
	res.json(evaluationItems);
});
app.get("/reports", async (req, res) => {
	const reportItems = await grabReports(BaseXContract);
	res.json(reportItems);
});
app.listen(3000, () => {
	console.log("Running on port 3000.");
});

module.exports = app;
