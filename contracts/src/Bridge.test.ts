import { Account, AccountUpdate, Encoding, Experimental, Int64, Mina, PrivateKey, UInt64 } from 'o1js'
import { Bridge } from './Bridge'
import { Token } from './Token'

const proofsEnabled = false

describe('token bridge test', () => {
    const Local = Mina.LocalBlockchain({ proofsEnabled })
    Mina.setActiveInstance(Local)

    const userPrivkey = Local.testAccounts[0].privateKey
    const userPubkey = Local.testAccounts[0].publicKey

    const tokenPrivkey = PrivateKey.random()
    const tokenPubkey = tokenPrivkey.toPublicKey()
    const tokenZkapp = new Token(tokenPubkey)

    const bridgePrivkey = PrivateKey.random()
    const bridgePubkey = bridgePrivkey.toPublicKey()
    const bridgeZkapp = new Bridge(bridgePubkey, tokenZkapp.token.id)

    const SYMBOL = Encoding.stringToFields('BTC')[0]
    const DECIMALS = UInt64.from(9)
    const SUPPLY_MAX = UInt64.from(21_000_000_000_000_000n)
    const AMOUNT_MINT = UInt64.from(20_000_000_000_000_000n)
    const AMOUNT_DEPOSIT = UInt64.from(5_000_000_000_000_000n)
    const AMOUNT_SEND = UInt64.from(1_000_000_000n)
    const AMOUNT_WITHDRAW = UInt64.from(3_000_000_000_000_000n)

    beforeAll(async () => {
        if (proofsEnabled) {
            await Bridge.compile()
            await Token.compile()
        }
    })

    it('can deploy tokens', async () => {
        const tx = await Mina.transaction(userPubkey, () => {
            AccountUpdate.fundNewAccount(userPubkey)
            tokenZkapp.deploy()
        })
        await tx.prove()
        tx.sign([userPrivkey, tokenPrivkey])
        await tx.send()
    })

    it('can initialize tokens', async () => {
        const tx = await Mina.transaction(userPubkey, () => {
            tokenZkapp.initialize(SYMBOL, DECIMALS, SUPPLY_MAX)
        })
        await tx.prove()
        tx.sign([userPrivkey, tokenPrivkey])
        await tx.send()
        tokenZkapp.decimals.getAndRequireEquals().assertEquals(DECIMALS)
        tokenZkapp.maxSupply.getAndRequireEquals().assertEquals(SUPPLY_MAX)
        tokenZkapp.circulatingSupply.getAndRequireEquals().assertEquals(UInt64.from(0))
    })

    it('can mint tokens', async () => {
        const tx = await Mina.transaction(userPubkey, () => {
            AccountUpdate.fundNewAccount(userPubkey)
            tokenZkapp.mint(userPubkey, AMOUNT_MINT)
        })
        await tx.prove()
        tx.sign([userPrivkey, tokenPrivkey])
        await tx.send()
        Mina.getBalance(userPubkey, tokenZkapp.token.id).assertEquals(AMOUNT_MINT)
        tokenZkapp.circulatingSupply.getAndRequireEquals().assertEquals(AMOUNT_MINT)
    })

    it('can deploy bridges', async () => {
        const tx = await Mina.transaction(userPubkey, () => {
            AccountUpdate.fundNewAccount(userPubkey)
            bridgeZkapp.deploy()
            tokenZkapp.approveUpdate(bridgeZkapp.self)
        })
        await tx.prove()
        tx.sign([userPrivkey, bridgePrivkey])
        await tx.send()
    })

    it('can deposit tokens into bridges', async () => {
        const tx = await Mina.transaction(userPubkey, () => {
            tokenZkapp.transfer(userPubkey, bridgePubkey, AMOUNT_DEPOSIT)
        })
        await tx.prove()
        tx.sign([userPrivkey])
        await tx.send()
        Mina.getBalance(userPubkey, tokenZkapp.token.id).assertEquals(AMOUNT_MINT.sub(AMOUNT_DEPOSIT))
        Mina.getBalance(bridgePubkey, tokenZkapp.token.id).assertEquals(AMOUNT_DEPOSIT)
    })

    it('can send tokens', async () => {
        const tx = await Mina.transaction(userPubkey, () => {
            const callback = Experimental.Callback.create(bridgeZkapp, "decrementBalance", [AMOUNT_SEND])
            tokenZkapp.sendTokensFromZkApp(userPubkey, AMOUNT_SEND, callback)        
        })
        await tx.prove()
        tx.sign([userPrivkey])
        await tx.send()
        Mina.getBalance(userPubkey, tokenZkapp.token.id).assertEquals(AMOUNT_MINT.sub(AMOUNT_DEPOSIT).add(AMOUNT_SEND))
        Mina.getBalance(bridgePubkey, tokenZkapp.token.id).assertEquals(AMOUNT_DEPOSIT.sub(AMOUNT_SEND))
    })

    // it('can lock tokens into bridges', async () => {
    //     const tx = await Mina.transaction(userPubkey, () => {
    //         // const callback = Experimental.Callback.create(bridgeZkapp, "lockToken", [tokenPubkey, userPubkey, AMOUNT_DEPOSIT])
    //         bridgeZkapp.lockToken(tokenPubkey, userPubkey, AMOUNT_DEPOSIT)
    //         tokenZkapp.transfer(userPubkey, bridgeZkapp.address, AMOUNT_DEPOSIT)
    //     })
    //     const bridgeTokenBalance = Mina.getBalance(bridgePubkey, tokenZkapp.token.id).value.toString()
    //     // console.log(`lock:`, { accountUpdate: Int64.fromObject(bridgeZkapp.self.body.balanceChange).toString(), bridgeTokenBalance, amount: AMOUNT_DEPOSIT.value.toString() })
    //     await tx.prove()
    //     tx.sign([userPrivkey])
    //     await tx.send()
    //     Mina.getBalance(userPubkey, tokenZkapp.token.id).assertEquals(AMOUNT_MINT.sub(AMOUNT_DEPOSIT))
    //     Mina.getBalance(bridgePubkey, tokenZkapp.token.id).assertEquals(AMOUNT_DEPOSIT)
    // })

    it('can unlock tokens from bridges', async () => {
        const tx = await Mina.transaction(userPubkey, () => {
            const callback = Experimental.Callback.create(bridgeZkapp, "unLockToken", [tokenPubkey, userPubkey, AMOUNT_WITHDRAW])
            tokenZkapp.sendTokensFromZkApp(userPubkey, AMOUNT_WITHDRAW, callback)
        })
        await tx.prove()
        tx.sign([userPrivkey])
        // console.log(tx.toPretty())
        await tx.send()
        const events = await bridgeZkapp.fetchEvents();
        console.log({ events: events[0].event.data })
        Mina.getBalance(userPubkey, tokenZkapp.token.id).assertEquals(
            AMOUNT_MINT.sub(AMOUNT_DEPOSIT).add(AMOUNT_SEND).add(AMOUNT_WITHDRAW)
        )
        Mina.getBalance(bridgePubkey, tokenZkapp.token.id).assertEquals(AMOUNT_DEPOSIT.sub(AMOUNT_SEND).sub(AMOUNT_WITHDRAW))
    })
})
