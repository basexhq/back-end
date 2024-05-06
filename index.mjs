/* const cors = require("cors");
const stripeController = require("./controllers/stripeController");
const express = require("express");
const { promisify } = require("util");
const bodyParser = require("body-parser"); */
import cors from "cors";
import stripeController from "./controllers/stripeController.mjs";
import express from "express";
import bodyParser from "body-parser";
const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const port = process.env.PORT || 3000;

app.use("/", stripeController);

app.get("/", (req, res) => {
	res.send(
		"<h1>GM!</h1><br>/reports /evaluations /organisations<br>/reports_staging /evaluations_staging /organisations_staging"
	);
});
// start server
app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
