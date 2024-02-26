const { default: Stripe } = require("stripe");
const { GENESIS_ABI, GENESIS_ADDRESS } = require("../contracts/min-Genesis");
const express = require("express");
const { ethers } = require("ethers");
const bodyParser = require("body-parser");
const env = require("dotenv");
env.config({ path: "./.env" });
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
	apiVersion: "2023-10-16",
	appInfo: {
		// For sample support and debugging, not required for production:
		name: "Genesis RE",
		url: "https://genesis.re/",
		version: "1.1.0",
	},
});

router.get("/config", (_, res) => {
	// Serve checkout page.
	res.send({
		publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
	});
});

async function convertEthToEur(ethPrice) {
	try {
		const response = await fetch(
			"https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur"
		);
		const data = await response.json();

		const eurPrice = ethPrice * data.ethereum.eur;
		return eurPrice;
	} catch (err) {
		console.error(err);
		return null;
	}
}
async function getCurrentPrice() {
	try {
		const network = "homestead"; // MAINNET

		const provider = new ethers.providers.InfuraProvider(
			network,
			process.env.INFURA_KEY
		);
		let GENESIS = new ethers.Contract(GENESIS_ADDRESS, GENESIS_ABI, provider);
		let currentPrice = ethers.utils.formatEther(await GENESIS.currentPrice());

		const currentPriceEur = await convertEthToEur(Number(currentPrice));
		if (currentPriceEur !== null) {
			console.log(
				"Current price: " + currentPrice + " ETH or " + currentPriceEur + " EUR"
			);
			return currentPriceEur;
		} else {
			console.log("Unable to fetch EUR price");
		}
	} catch (err) {
		console.log(err);
	}
}
router.get("/create-payment-intent", async (req, res) => {
	const price = await getCurrentPrice();
	// Create a PaymentIntent with the order amount and currency.
	const params = {
		amount: Math.round(Number(price * 100)),
		currency: "EUR",
		automatic_payment_methods: {
			enabled: true,
		},
	};
	try {
		const paymentIntent = await stripe.paymentIntents.create(params);

		// Send publishable key and PaymentIntent client_secret to client.
		res.send({
			clientSecret: paymentIntent.client_secret,
			amount: Math.round(Number(price)),
		});
	} catch (e) {
		res.status(400).send({
			error: {
				message: e.message,
			},
		});
	}
});
router.get("/create-test-intent", async (req, res) => {
	// Create a PaymentIntent with the order amount and currency.
	const params = {
		amount: 100,
		currency: "EUR",
		automatic_payment_methods: {
			enabled: true,
		},
	};
	try {
		const paymentIntent = await stripe.paymentIntents.create(params);

		// Send publishable key and PaymentIntent client_secret to client.
		res.send({
			clientSecret: paymentIntent.client_secret,
			amount: 1,
		});
	} catch (e) {
		res.status(400).send({
			error: {
				message: e.message,
			},
		});
	}
});
router.post(
	"/webhook",
	// Use body-parser to retrieve the raw body as a buffer.
	// @ts-ignore
	bodyParser.raw({ type: "application/json" }),
	async (req, res) => {
		// Retrieve the event by verifying the signature using the raw body and secret.
		let event;

		try {
			event = stripe.webhooks.constructEvent(
				req.body,
				req.headers["stripe-signature"],
				process.env.STRIPE_WEBHOOK_SECRET
			);
		} catch (err) {
			console.log(`⚠️  Webhook signature verification failed.`);
			res.sendStatus(400);
			return;
		}

		// Extract the data from the event.
		const data = event.data;
		const eventType = event.type;

		if (eventType === "payment_intent.succeeded") {
			// Cast the event into a PaymentIntent to make use of the types.
			const pi = data.object;
			// Funds have been captured
			// Fulfill any orders, e-mail receipts, etc
			// To cancel the payment after capture you will need to issue a Refund (https://stripe.com/docs/api/refunds).
			console.log("💰 Payment captured!");
		} else if (eventType === "payment_intent.payment_failed") {
			// Cast the event into a PaymentIntent to make use of the types.
			const pi = data.object;
			console.log("❌ Payment failed.");
		}
		res.sendStatus(200);
	}
);
module.exports = router;
