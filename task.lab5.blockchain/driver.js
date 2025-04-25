"use strict";

const blindSignatures = require("blind-signatures");

const { Coin, COIN_RIS_LENGTH, IDENT_STR, BANK_STR } = require("./coin.js");
const utils = require("./utils.js");

// Details about the bank's key.
const BANK_KEY = blindSignatures.keyGeneration({ b: 2048 });
const N = BANK_KEY.keyPair.n.toString();
const E = BANK_KEY.keyPair.e.toString();

/**
 * Function signing the coin on behalf of the bank.
 *
 * @param blindedCoinHash - the blinded hash of the coin.
 *
 * @returns the signature of the bank for this coin.
 */
function signCoin(blindedCoinHash) {
  return blindSignatures.sign({
    blinded: blindedCoinHash,
    key: BANK_KEY,
  });
}

/**
 * Parses a string representing a coin, and returns the left/right identity string hashes.
 *
 * @param {string} s - string representation of a coin.
 *
 * @returns {[[string]]} - two arrays of strings of hashes, commiting the owner's identity.
 */
function parseCoin(s) {
  let [cnst, amt, guid, leftHashes, rightHashes] = s.split("-");
  if (cnst !== BANK_STR) {
    throw new Error(
      `Invalid identity string: ${cnst} received, but ${BANK_STR} expected`
    );
  }
  //console.log(`Parsing ${guid}, valued at ${amt} coins.`);
  let lh = leftHashes.split(",");
  let rh = rightHashes.split(",");
  return [lh, rh];
}

/**
 * Procedure for a merchant accepting a token. The merchant randomly selects
 * the left or right halves of the identity string.
 *
 * @param {Coin} - the coin that a purchaser wants to use.
 *
 * @returns {[String]} - an array of strings, each holding half of the user's identity.
 */
function acceptCoin(coin) {
  const isValid = blindSignatures.verify({
    unblinded: coin.signature,
    N: coin.n,
    E: coin.e,
    message: coin.toString(),
  });

  if (!isValid) {
    throw new Error("Invalid signature!");
  }

  const [leftHashes, rightHashes] = parseCoin(coin.toString());

  let ris = [];
  for (let i = 0; i < leftHashes.length; i++) {
    const chooseLeft = Math.random() < 0.5;
    const value = coin.getRis(chooseLeft, i);
    const expectedHash = chooseLeft ? leftHashes[i] : rightHashes[i];
    const actualHash = utils.hash(value);

    if (actualHash !== expectedHash) {
      throw new Error(`Hash mismatch at index ${i}`);
    }

    ris.push(value.toString("hex"));
  }

  return ris;
}

function determineCheater(guid, ris1, ris2) {
  for (let i = 0; i < ris1.length; i++) {
    if (ris1[i] !== ris2[i]) {
      const buf1 = Buffer.from(ris1[i], "hex");
      const buf2 = Buffer.from(ris2[i], "hex");
      const result = Buffer.alloc(buf1.length);

      for (let j = 0; j < buf1.length; j++) {
        result[j] = buf1[j] ^ buf2[j];
      }

      const revealed = result.toString();

      if (revealed.startsWith(IDENT_STR)) {
        const identity = revealed.slice(IDENT_STR.length);
        console.log(
          `💥 Coin ${guid} was double-spent by purchaser: ${identity}`
        );
      } else {
        console.log(
          `❗ Coin ${guid} was double-spent. One of the merchants is a cheater.`
        );
      }
      return;
    }
  }

  console.log(
    `⚠️ Coin ${guid} used twice with same RIS. Merchant is the likely cheater.`
  );
}

// ------------------ DEMO ---------------------

let coin = new Coin("alice", 20, N, E);

coin.signature = signCoin(coin.blinded);

coin.unblind();

// Merchant 1 accepts the coin.
let ris1 = acceptCoin(coin);

// Merchant 2 accepts the same coin.
let ris2 = acceptCoin(coin);

// The bank realizes that there is an issue and
console.log("\n🔍 Checking double spending...");
determineCheater(coin.guid, ris1, ris2);

console.log("\n🤥 Checking for cheating merchant...");
// On the other hand, if the RIS strings are the same,
// the merchant is marked as the cheater.
determineCheater(coin.guid, ris1, ris1);
