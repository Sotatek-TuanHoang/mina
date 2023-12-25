import { PublicKey, SmartContract, State, UInt64, method, state, Struct } from 'o1js'
import { Token } from './Token'

class LockEvent extends Struct({
    tokenAddress: PublicKey,
    receiver: PublicKey,
    amount: UInt64
}){
    constructor(tokenAddress: PublicKey, receiver: PublicKey, amount: UInt64) {
        super({ tokenAddress, receiver, amount });
      }
}

export class Bridge extends SmartContract {

    events = {"Lock": LockEvent};
    @method decrementBalance(amount: UInt64) {
        this.balance.subInPlace(amount)
    }

    @method lock(tokenAddress: PublicKey, receiver: PublicKey, amount: UInt64) {
        // const weth = new Token(tokenAddress);
        // weth.transfer(this.sender, this.address, amount);
        this.emitEvent("Lock", new LockEvent(tokenAddress, receiver, amount));
    }
}
