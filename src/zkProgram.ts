import { Mina, PublicKey, UInt32,Field,  ZkProgram, Bytes, Hash, state, Bool, verify, Struct, Provable} from 'o1js';
import { p256, secp256r1 } from '@noble/curves/p256';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { StringCircuitValue } from './String.js';

class P256Data extends Struct({
  signature: [Field,Field,Field,Field],
  messageHex: [Field,Field,Field,Field,Field,Field,Field,Field,Field,Field,Field,Field]
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
      privateInputs: [Field, P256Data, Field,Field,Field,Field], 
      async method (
        commitment: PublicArgumets,
        decommitment: Field,
        p256_data: P256Data,
        field1:Field,
        field2:Field,
        field3:Field,
        field4:Field
      ){
          //P256 Signature Verification
          const assert = Bool(true);
          
          Provable.asProver(()=>{
            //let concatSignature = `${field1.toBigInt().toString(16)}${field2.toBigInt().toString(16)}${field3.toBigInt().toString(16)}${field4.toBigInt().toString(16)}`;
            let concatSignature = ``;
            let concatMessage = ``;
            
            p256_data.messageHex.forEach(part=>{
              concatMessage += part.toBigInt().toString(16);
            })

            p256_data.signature.forEach(part=>{
              concatSignature += part.toBigInt().toString(16);
            })

            console.log(`Inside zkProgram: ${concatSignature}`)
            const messageHex:string = concatMessage.slice(0,374);
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