const request = require("supertest");
const express = require("express");
const transferRouter = require("./transferRouter");
const {expect} = require("chai");
const {errorHandler} = require("./utils");
const sinon = require("sinon");
const ApiKeyService = require("../services/ApiKeyService");
const bodyParser = require('body-parser');
const WalletService = require("../services/WalletService");
const JWTService = require("../services/JWTService");
const HttpError = require("../utils/HttpError");
const Token = require("../models/Token");
const TokenService = require("../services/TokenService");
const Wallet = require("../models/Wallet");
const Transfer = require("../models/Transfer");
const TransferService = require("../services/TransferService");
const Session = require("../models/Session");
const { extractExpectedAssertionsErrors } = require("expect");
const { column } = require("../database/knex");

describe("transferRouter", () => {
  let app;
  let session = new Session();

  const walletLogin = {
    id: 1,
  }

  beforeEach(() => {
    sinon.stub(Session.prototype);
    sinon.stub(ApiKeyService.prototype, "check");
    sinon.stub(JWTService.prototype, "verify").returns({
      id: walletLogin.id,
    });
    app = express();
    app.use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
    app.use(bodyParser.json()); // parse application/json
    app.use(transferRouter);
    app.use(errorHandler);
  })

  afterEach(() => {
    sinon.restore();
  })

  // test for limit 
  it("limit parameters missed", async () => {
    const res = await request(app)
      .get("/");
    expect(res).property("statusCode").eq(422);
  });

  it("with limit and offset specified, should return correct number", async () => {
    sinon
      .stub(WalletService.prototype, 'getById')
      .resolves(new Wallet(1));
    sinon
      .stub(WalletService.prototype, 'getByIdOrName')
      .resolves(new Wallet(1));

    sinon.stub(Wallet.prototype, 'getTransfers').resolves(
      [{},{},{},{},{},{},{},{},{},{}].map((_,i) => ({id:i, state:Transfer.STATE.completed})
      ));

    sinon.stub(TransferService.prototype, "convertToResponse")
    .onCall(0).resolves({id:0, state:Transfer.STATE.completed})
    .onCall(1).resolves({id:1, state:Transfer.STATE.completed})
    .onCall(2).resolves({id:2, state:Transfer.STATE.completed})
    .onCall(3).resolves({id:3, state:Transfer.STATE.completed})
    .onCall(4).resolves({id:4, state:Transfer.STATE.completed})
    .onCall(5).resolves({id:5, state:Transfer.STATE.completed})
    .onCall(6).resolves({id:6, state:Transfer.STATE.completed})
    .onCall(7).resolves({id:7, state:Transfer.STATE.completed})
    .onCall(8).resolves({id:8, state:Transfer.STATE.completed})
    .onCall(9).resolves({id:9, state:Transfer.STATE.completed});

    const res = await request(app)
      .get("/?limit=3&wallet=testWallet&start=5");
    expect(res.body.transfers).lengthOf(3);
    // console.log("HERE2");
    // console.log(res.body.transfers);
    expect(res.body.transfers.map(t=>(t.id))).to.deep.equal([4, 5, 6]);
  });

  it("missing tokens should throw error", async () => {
    const res = await request(app)
      .post("/")
      .send({
        sender_wallet: "ssss",
        receiver_wallet: "ssss",
      });
    expect(res).property("statusCode").eq(422);
    expect(res.body.message).match(/bundle.*required/);
  });

  it("missing sender wallet should throw error", async () => {
    const res = await request(app)
      .post("/")
      .send({
        tokens: ["1"],
        receiver_wallet: "ssss",
      });
    expect(res).property("statusCode").eq(422);
    expect(res.body.message).match(/sender.*required/);
  });

  it("Duplicated token uuid should throw error", async () => {
    const res = await request(app)
      .post("/")
      .send({
        tokens: ["1", "1"],
        receiver_wallet: "ssss",
        sender_wallet: "ssss",
      });
    expect(res).property("statusCode").eq(422);
    expect(res.body.message).match(/duplicate/i);
  });

  it('transfer using sender and receiver name, should return 201', async () => {
    sinon
      .stub(WalletService.prototype, 'getById')
      .resolves(new Wallet(1));
    sinon
      .stub(WalletService.prototype, 'getByIdOrName')
      .onFirstCall()
      .resolves(new Wallet(1))
      .onSecondCall()
      .resolves(new Wallet(2));
    sinon.stub(TokenService.prototype, 'getByUUID').resolves(
      new Token({
        id: 1,
        entity_id: 1,
      }),
    );
    sinon.stub(Wallet.prototype, 'transfer').resolves({
      id: 1,
      state: Transfer.STATE.completed,
    });
    sinon.stub(TransferService.prototype, 'convertToResponse').resolves({
      id: 1,
      state: Transfer.STATE.completed,
    });
    const res = await request(app)
      .post('/')
      .send({
        tokens: ['1'],
        sender_wallet: 'wallet1',
        receiver_wallet: 'wallet2',
      });
    expect(res).property('statusCode').eq(201);
  });

  it('Transfer using sender and receiver id, should return 201', async () => {
    sinon
      .stub(WalletService.prototype, 'getById')
      .onFirstCall()
      .resolves(new Wallet(1));
    sinon
      .stub(WalletService.prototype, 'getByIdOrName')
      .onFirstCall()
      .resolves(new Wallet(1))
      .onSecondCall()
      .resolves(new Wallet(2));

    sinon.stub(TokenService.prototype, 'getByUUID').resolves(
      new Token({
        id: 1,
        entity_id: 1,
      }),
    );
    sinon.stub(Wallet.prototype, 'transfer').resolves({
      id: 1,
      state: Transfer.STATE.completed,
    });
    sinon.stub(TransferService.prototype, 'convertToResponse').resolves({
      id: 1,
      state: Transfer.STATE.completed,
    });
    const res = await request(app)
      .post('/')
      .send({
        tokens: ['1'],
        sender_wallet: 1,
        receiver_wallet: 2,
      });
    expect(res).property('statusCode').eq(201);
  });

  //TODO: test for case 1: with trust relationship, tokens specified
  it.only('claim transfer with existing trust relationship, and specified tokens', async () => {
    sinon
      .stub(WalletService.prototype, 'getById')
      .resolves(new Wallet(1));
    sinon
      .stub(WalletService.prototype, 'getByIdOrName')
      .onFirstCall()
      .resolves(new Wallet(1))
      .onSecondCall()
      .resolves(new Wallet(2));
    sinon.stub(TokenService.prototype, 'getByUUID').resolves(
      new Token({
        id: 1,
        entity_id: 1,
      }),
    );
    sinon.stub(Wallet.prototype, 'transfer').resolves({
      id: 1,
      state: Transfer.STATE.completed,
    });
    sinon.stub(TransferService.prototype, 'convertToResponse').resolves({
      id: 1,
      state: Transfer.STATE.completed,
    });

    const res = await request(app)
      .post('/')
      .send({
        tokens: ['1'],
        sender_wallet: 1,
        receiver_wallet: 2,
        claim: true,
      });
    
    console.log(res);
    expect(res).property('statusCode').eq(201);
  });

  //check what's in the db, after transfer claim
  // test transfer, in wallet.spec.js

  it("all parameters fine, but no trust relationship, should return 202", async () => {
    sinon.stub(WalletService.prototype, "getByIdOrName").resolves(new Wallet(1));
    sinon.stub(WalletService.prototype, "getById").resolves({
      transfer: () => {},
    });
    sinon.stub(TokenService.prototype, "getByUUID").resolves(new Token({
      id:1,
      entity_id: 1,
    }, session));
    WalletService.prototype.getById.restore();    
    sinon.stub(WalletService.prototype, "getById").resolves({
      transfer: async () => {
        throw new HttpError(202);
      },
    });
    const res = await request(app)
      .post("/")
      .send({
        tokens: ["1"],
        sender_wallet: "ssss",
        receiver_wallet: "ssss",
      });
    expect(res).property("statusCode").eq(202);
  });

  it("bundle case, success, should return 201", async () => {
    sinon.stub(WalletService.prototype, "getByIdOrName").resolves(new Wallet(1));
    sinon.stub(WalletService.prototype, "getById").resolves({
      transfer: () => {},
    });
    sinon.stub(TokenService.prototype, "getByUUID").resolves(new Token({
      id:1,
      entity_id: 1,
    }, session));
    WalletService.prototype.getById.restore();    
    sinon.stub(WalletService.prototype, "getById").resolves({
      transferBundle: async () => {
        throw new HttpError(202);
      },
    });
    const res = await request(app)
      .post("/")
      .send({
        bundle: {
          bundle_size: 1,
        },
        sender_wallet: "ssss",
        receiver_wallet: "ssss",
      });
    expect(res).property("statusCode").eq(202);
  });

  it("bundle case, -1 should throw error", async () => {
    const res = await request(app)
      .post("/")
      .send({
        bundle: {
          bundle_size: -1,
        },
        sender_wallet: "ssss",
        receiver_wallet: "ssss",
      });
    expect(res).property("statusCode").eq(422);
    expect(res.body.message).match(/greater/);
  });

  it("bundle case, 1.1 should throw error", async () => {
    const res = await request(app)
      .post("/")
      .send({
        bundle: {
          bundle_size: 1.1,
        },
        sender_wallet: "ssss",
        receiver_wallet: "ssss",
      });
    expect(res).property("statusCode").eq(422);
    expect(res.body.message).match(/integer/);
  });

  it("bundle case, 10001 should throw error", async () => {
    const res = await request(app)
      .post("/")
      .send({
        bundle: {
          bundle_size: 10001,
        },
        sender_wallet: "ssss",
        receiver_wallet: "ssss",
      });
    expect(res).property("statusCode").eq(422);
    expect(res.body.message).match(/less/);
  });


  describe("/fulfill", () => {

    it("Nether tokens nor implicit is specified, should throw error", async () => {
      const res = await request(app)
        .post("/1/fulfill")
        .send({
        });
      expect(res).property("statusCode").eq(422);
      expect(res.body.message).match(/implicit.*required/i);
    });

    it("Duplicated token uuid should throw error", async () => {
      const res = await request(app)
        .post("/1/fulfill")
        .send({
          tokens: ["1", "1"],
        });
      expect(res).property("statusCode").eq(422);
      expect(res.body.message).match(/duplicate/i);
    });
  });

  describe("GET /{transfer_id}", () => {

    it("Successfully", async () => {
      const wallet = new Wallet(1);
      const transfer = {id:2};
      const fn = sinon.stub(WalletService.prototype, "getById").resolves(wallet);
      const fn2 = sinon.stub(Wallet.prototype, "getTransferById").resolves(transfer);
      const fn3 = sinon.stub(TransferService.prototype, "convertToResponse").resolves(transfer);
      const res = await request(app)
        .get("/2");
      expect(fn).calledWith(1);
      expect(fn2).calledWith(2);
      expect(fn3).calledWith(transfer);
      expect(res).property("statusCode").eq(200);
      expect(res.body).property("id").eq(2);
    });
  });

  describe("GET /{transfer_id}/tokens start and limit working", () => {

    it("Successfully", async () => {
      const wallet = new Wallet(1);
      const transfer = {id:2};
      const token = new Token({id:3});
      const fn = sinon.stub(WalletService.prototype, "getById").resolves(wallet);
      const fn2 = sinon.stub(Wallet.prototype, "getTokensByTransferId").resolves([token]);
      const res = await request(app)
        .get("/2/tokens?limit=1");
      expect(fn).calledWith(1);
      expect(fn2).calledWith(2);
      expect(res).property("statusCode").eq(200);
      expect(res.body).property("tokens").lengthOf(1);
    });

    it("limit and start working successfully", async () => {
      const wallet = new Wallet(1);
      const transfer = {id:2};
      const token = new Token({id:3});
      const token2 = new Token({id:4});
      const token3 = new Token({id:5});
      const token4 = new Token({id:6});
      const fn = sinon.stub(WalletService.prototype, "getById").resolves(wallet);
      const fn2 = sinon.stub(Wallet.prototype, "getTokensByTransferId").resolves([token, token2, token3, token4]);
      const res = await request(app)
        .get("/2/tokens?limit=3&start=2");
      expect(fn).calledWith(1);
      expect(fn2).calledWith(2);
      expect(res).property("statusCode").eq(200);
      console.log(res.body);
      expect(res.body).property("tokens").lengthOf(3);
      expect(res.body.tokens.map(t=>(t.id))).to.deep.equal([4, 5, 6]);
    });
  })


});
