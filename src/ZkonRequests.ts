import { SmartContract, PublicKey, state, State, method, Field, DeployArgs, Struct, Proof } from 'o1js';
import {ZkonRequestCoordinator} from './ZkonRequestCoordinator.js';

export interface AppDeployProps extends Exclude<DeployArgs, undefined> {
  coordinator: PublicKey  
}

class Commitments extends Struct({
  availableSupply: Field, timestamp: Field
}){
  constructor(value:{availableSupply: Field, timestamp: Field}){
    super(value)
  }
}

//ToDo: String might not work. Replace with circuit string.
class ApiResponseData extends Struct({
  symbol: String,
  name: String,
  website: String,
  twitter: String,
  lastUpdatedAt:Field,
  availableSupply:Field,
  circulatingSupply:Field,
  totalSupply:Field,
  networks:[String, String, String],
  icon: String
}){}

class ApiResponse extends Struct ({
  status: String,
  data: ApiResponseData,
  timestamp: Field
}){}


export class ZkonEgrains extends SmartContract{
  @state(PublicKey) coordinator = State<PublicKey>();

  async deploy(props: AppDeployProps) {
    await super.deploy(props);
    this.coordinator.set(props.coordinator);
  }

  @method.returns(Field)
  async sendRequest(proof: Proof<Commitments,void>, apiData: ApiResponse) {
    const coordinatorAddress = this.coordinator.getAndRequireEquals();
    const coordinator = new ZkonRequestCoordinator(coordinatorAddress);
    
    return coordinator.sendRequest(this.address, proof, apiData);
  }
}