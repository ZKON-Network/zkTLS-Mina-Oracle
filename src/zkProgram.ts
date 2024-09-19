import { Mina, Field, ZkProgram, Struct, createEcdsaV2, createForeignCurveV2,Crypto, Scalar, Bool} from 'o1js';
import { proveableECDSAreturnR } from './proveableECDSA.js'

class Secp256k1 extends createForeignCurveV2(Crypto.CurveParams.Secp256k1) {}
class Ecdsa extends createEcdsaV2(Secp256k1) {}

class ECDSAHelper extends Struct({
  messageHash: BigInt,
  signature: Ecdsa,
  publicKey: Secp256k1
}){}

class PublicArgumets extends Struct({
    commitment: Field,
    dataField:Field
  }){}

const ZkonZkProgram = ZkProgram({
    name:'zkon-proof',
    publicInput: PublicArgumets,
    publicOutput: Bool,
  
    methods:{
      verifySource:{
        privateInputs: [Field, ECDSAHelper], 
        async method (
          commitment: PublicArgumets,
          decommitment: Field,
          ECDSASign:ECDSAHelper,
        ){
          // decommitment.assertEquals(commitment.commitment,"Response invalid.");
          return ECDSASign.signature.verifySignedHashV2(
            ECDSASign.messageHash, ECDSASign.publicKey)
        }
      }
    }
  });

  export {ZkonZkProgram , PublicArgumets ,ECDSAHelper};
