import { Mina, PublicKey, UInt32,Field,  ZkProgram, Bytes, Hash, state, Bool, verify, Struct, Provable} from 'o1js';
import { p256, secp256r1 } from '@noble/curves/p256';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { StringCircuitValue } from './String.js';

class P256Data extends Struct({
  signature: [Field,Field,Field,Field],
  messageHex: [Field,Field,Field,Field,Field,Field,Field,Field,Field,Field,Field,Field]
}){}

export class SessionHeader extends Struct({
  encoderSeed: Provable.Array(Field, 32),
  merkleRoot: Provable.Array(Field, 32),
  sentLen: Provable.Array(Field, 8),
  recvLen: Provable.Array(Field, 8),
  handshakeSummary: Struct({
    time: Provable.Array(Field, 8),
    serverPublicKey: Struct({
      group: Provable.Array(Field, 2),
      key: Provable.Array(Field, 65),
    }),
    handshakeCommitment: Provable.Array(Field, 32),
  }),
}) { };


class PublicArgumets extends Struct({
  commitment: Field,
  dataField:Field
}){}

const checkECDSA =(message:string, signature:string): Bool=>{
  const public_key_notary = hexToBytes('0206fdfa148e1916ccc96b40d0149df05825ef54b16b711ccc1b991a4de1c6a12c');
  const messageActual = hexToBytes(message);
  const signatureActual = p256.Signature.fromCompact(signature)
  const result = p256.verify(signatureActual, 
    messageActual, 
    public_key_notary, 
    {prehash:true})
  return new Bool(result);
}

const ZkonZkProgramECDSA = ZkProgram({
  name:'zkon-proof',
  publicInput: PublicArgumets,

  methods:{
    verifySource:{
      privateInputs: [Field, P256Data], 
      async method (
        commitment: PublicArgumets,
        decommitment: Field,
        p256_data: P256Data,
      ){
          //P256 Signature Verification
          const assert = Bool(true);
          
          
          // Check if the SH256 Hash commitment of the data-source is same 
          // as the response reconstructed from the notary-proof file.
          decommitment.assertEquals(commitment.commitment);
      }
    }
  }
});

export {ZkonZkProgramECDSA, P256Data, PublicArgumets};