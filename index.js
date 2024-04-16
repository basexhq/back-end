const cors = require("cors");
const stripeController = require("./controllers/stripeController");
const express = require("express");
const { promisify } = require("util");
const bodyParser = require("body-parser");
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
