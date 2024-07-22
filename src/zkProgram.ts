import { Mina, PublicKey, UInt32,Field,  ZkProgram, Bytes, Hash, state, Bool, verify, Struct, Provable} from 'o1js';
import { p256, secp256r1 } from '@noble/curves/p256';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { StringCircuitValue } from './String.js';

class P256Data extends Struct({
  signature: [StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue],
  messageHex: [StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue,StringCircuitValue]
}){}

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

const ZkonZkProgramTest = ZkProgram({
  name:'zkon-proof',
  publicInput: PublicArgumets,

  methods:{
    verifySource:{
      privateInputs: [Field, P256Data], 
      async method (
        commitment: PublicArgumets,
        decommitment: Field,
        p256_data: P256Data
      ){
          //P256 Signature Verification
          const assert = Bool(true);
          
          Provable.asProver(()=>{
            let concatSignature = `${p256_data.signature[0].toString()}`;
            let concatMessage = ``;
            console.log(concatSignature)

            // p256_data.messageHex.forEach(part=>{
            //   concatMessage += part.toString();
            // })

            // p256_data.signature.forEach(part=>{
            //   concatSignature += part.toString();
            // })

            const messageHex:string = concatMessage;
            const signature: string = concatSignature;
            const checkECDSASignature = checkECDSA(messageHex, signature);
            assert.assertEquals(checkECDSASignature);
          })
          
          // Check if the SH256 Hash commitment of the data-source is same 
          // as the response reconstructed from the notary-proof file.
          decommitment.assertEquals(commitment.commitment);
      }
    }
  }
});

export {ZkonZkProgramTest, P256Data, PublicArgumets};