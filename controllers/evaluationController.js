const express = require("express");
const router = express.Router();
const { grabEvaluations } = require("../evaluations/grabEvaluations");

router.get("/evaluations", async (req, res) => {
	const evaluationItems = await grabEvaluations();
	res.json(evaluationItems);
});

router.get("/evaluations_staging", async (req, res) => {
	const evaluationItems = await grabEvaluations(true);
	res.json(evaluationItems);
});

module.exports = router;
