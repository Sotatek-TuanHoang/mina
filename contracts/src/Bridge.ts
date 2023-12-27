import { PublicKey, SmartContract, State, UInt64, method, state, Struct, Field, Experimental, Provable } from 'o1js'
import { Token } from './Token'

class LockEvent extends Struct({
    tokenAddress: PublicKey,
    sender: PublicKey,
    amount: UInt64,
}) {
    constructor(tokenAddress: PublicKey, sender: PublicKey, amount: UInt64) {
        super({ tokenAddress, sender, amount })
    }
}

class UnLockEvent extends Struct({
    tokenAddress: PublicKey,
    receiver: PublicKey,
    amount: UInt64,
}) {
    constructor(tokenAddress: PublicKey, receiver: PublicKey, amount: UInt64) {
        super({ tokenAddress, receiver, amount })
    }
}

export class Bridge extends SmartContract {
    @state(UInt64) test = State<UInt64>()
    events = { Lock: LockEvent, Unlock: UnLockEvent, Hello: Field }
    @method decrementBalance(amount: UInt64) {
        this.balance.subInPlace(amount)
    }

    @method lockToken(tokenAddress: PublicKey, sender: PublicKey, amount: UInt64, callback: Experimental.Callback<any>) {
        const weth = new Token(tokenAddress)
        weth.sendTokensFromZkApp(this.address, amount, callback)
        this.emitEvent('Lock', new LockEvent(tokenAddress, sender, amount))
    }

    @method unLockToken(tokenAddress: PublicKey, receiver: PublicKey, amount: UInt64) {
        this.balance.subInPlace(amount)
        this.emitEvent('Unlock', new UnLockEvent(tokenAddress, receiver, amount))
    }
}
