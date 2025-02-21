![Render - zkTLS Mina Oracle Integration](https://github.com/user-attachments/assets/6d0ed147-fa0c-4ba0-b501-633d7f968cea)

# TrueData zkOracle - zkTLS Mina Integration | ZKON
<img width="1352" alt="zkOracle - Schema 04" src="https://github.com/user-attachments/assets/f2990203-6237-483d-94c2-c05f40e93df3">

## Compiling the Verifier module

Navigate to `/verifier`, and run `npm build`. This is an essential step for the entire flow to compile. 

## How to run?

`npm run watch` to run index.ts in watch mode. 
Disable the SSL Check agent before actual production use.

## Env files

Env files are read after sanity type checks. Please modify the structure of structure of the env interface in `configs.ts`

## How commitment scheme works currently?

Suppose an API has response, 
```
response={
    "demo":"data",
    "demoField":"dataField",
    .
    .
    .
    "demoField-n":"dataField-n"
}
```
The TLS Notary client calculates the SHA256 commitment of this response. Say the `Commitment(response) == SHA256(String(response))`

Assume, SHA256(responseDataSource) = abc..z
From the MPC Prover Client, we get:

```
response_from_proofEndpoint={
    "notary_proof":Equivalent of the proof.json,
    "CM":SHA256(responseDataSource),
    "api_response":{actual dataSource Response}
}
```

What happens inside the Oracle post recieving this response?
1. The notary_proof is verified to be correct. 
2. From this verified proof, the actual datasource response is fetched.
3. Decommitment is constructed of the same response.
4. From the notary_proof, the signature data is taken, and a byte array is constructed to handle the message of the P256 Signature. 
5. To the zkProgram, we send:
- The original commitment, SHA256(responseDataSource)
- The constructed decommitment from the proof.json 
- P256 Data i.e the Signature & data byte array.
6. The Proof is computed only
- if the signature is correct & verified
- the commitment from the \proof endpoint matches the decommitment constructed.

### ToDo

- [x] Change the TLSNotary-Cleint Endpoint.
- [x] Make the TLSNotary client accept the requestObject
- [x] Accomodate zkProgram changes
- [x] Fix the commiment scheme, to make a uniform proof irrespective of data-source Endpoint.
- [x] Change TLSNotary Client to accomodate generic data-source URLs. 
- [ ] Use zkapp from IPFS & send back the event. 

---

# **Formal Security Analysis of ZKON’s zkTLS Mina Oracle**

This document presents a comprehensive and rigorous formal security analysis of ZKON’s zkTLS Mina Oracle, including formal adversary models, security assumptions, cryptographic definitions, detailed definitions of attacks, game-based security definitions, and rigorous proofs by contradiction. All elements are connected to adversary models and underlying cryptographic assumptions to ensure completeness and coherence.

## **1. Formal Adversary Model**

We consider adversaries $\mathcal{A}$ with the following capabilities:

- **$\mathcal{A}_{\mathsf{passive}}$**: Observes all network communications but cannot modify them.
- **$\mathcal{A}_{\mathsf{active}}$**: Can modify, replay, or inject messages into network communications.
- **$\mathcal{A}_{O}$**: Corrupts the Oracle $O$, gaining access to its internal state, computation, and partial MPC data.
- **$\mathcal{A}_{B}$**: Corrupts the blockchain $B$, attempting to tamper with on-chain proofs and state.

## **2. Security Assumptions**

We assume:

- **A1. IND-CCA security of TLS:** TLS session keys are indistinguishable from random values.
- **A2. Collision resistance of $H$:** No adversary can find collisions in $H$.
- **A3. Soundness of zkProofs:** No adversary can forge a proof without the correct witness.
- **A4. MPC privacy and correctness:** No partial collusion reveals the input.

## **3. Formal Cryptographic Definitions**

We define:

- **D1. Confidentiality:** Ensures that no adversary $\mathcal{A}_{\mathsf{passive}}$ learns the session key $k_{session}$ or message $m$.
- **D2. Integrity:** Guarantees that $\mathcal{A}_{\mathsf{active}}$ cannot modify $m$ or the commitment $CM$ without detection.
- **D3. Authenticity:** Ensures that no adversary $\mathcal{A}_{\mathsf{active}}$ or $\mathcal{A}_{O}$ can impersonate honest parties or forge valid proofs $\pi$.
- **D4. Availability:** Ensures that $\mathcal{A}_{\mathsf{active}}$ or $\mathcal{A}_{O}$ cannot prevent $\Pi_{zkTLS}$ from completing successfully.

## **4. Attack Definitions and Connections to Adversary Model**

### **4.1 Fake Key Reveal Attack**  
- **Description:** $\mathcal{A}_{\mathsf{active}}$ or $\mathcal{A}_{O}$ tries to provide a fake session key $k'$ or tamper with the established TLS key.
- **Security Property:** Confidentiality and authenticity prevent such forgeries without breaking TLS security or zkProof soundness.

### **4.2 Data Injection Attack**  
- **Description:** $\mathcal{A}_{\mathsf{active}}$ injects false data $m'$ into the TLS session.
- **Security Property:** Integrity ensures any alteration results in a commitment collision, violating $H$.

### **4.3 Collusion Attack Among Oracle Nodes**  
- **Description:** $\mathcal{A}_{O}$ corrupts Oracle nodes to reconstruct user secrets from MPC shares.
- **Security Property:** MPC privacy ensures no partial collusion reveals $m$.

## **5. Game-Based Security Definitions**

We define the following games:

- **G1. Confidentiality Game ($\mathcal{A}_{\mathsf{passive}}$)**: Tests if $\mathcal{A}_{\mathsf{passive}}$ can distinguish $m$ from random ciphertexts.
- **G2. Integrity Game ($\mathcal{A}_{\mathsf{active}}$)**: Tests if $\mathcal{A}_{\mathsf{active}}$ can modify $m$ without detection.
- **G3. Authenticity Game ($\mathcal{A}_{\mathsf{active}}, \mathcal{A}_{O}$)**: Tests if $\mathcal{A}$ can forge $m$ or $\pi$.
- **G4. Availability Game ($\mathcal{A}_{\mathsf{active}}, \mathcal{A}_{O}$)**: Tests if $\mathcal{A}$ can halt $\Pi_{zkTLS}$.

## **6. Proofs of Security**

### **6.1 Proof of Confidentiality**

#### **Theorem:**
No PPT adversary $( \mathcal{A}_{\mathsf{passive}} )$ can break the confidentiality of $( \Pi_{zkTLS} )$ without violating the IND-CCA security of TLS or the privacy guarantees of MPC.

#### **Proof (by contradiction):**  
$$
\text{Assume there exists a PPT adversary } \mathcal{A}_{\mathsf{passive}} \text{ that breaks the confidentiality of } \Pi_{zkTLS} \text{ with non-negligible probability.}
$$

- **Game $( G_0 )$:** The challenger initializes the TLS handshake, producing a session key $( k_{session} )$.
- **Game $( G_1 )$:** $( \mathcal{A}_{\mathsf{passive}} )$ is given ciphertexts $( Enc_{k_{session}}(m_0) )$ and $( Enc_{k_{session}}(m_1) )$. The adversary guesses $( b )$ where $( m_b )$ is the plaintext.

If $( \mathcal{A}_{\mathsf{passive}} )$ distinguishes with non-negligible probability, it implies a break in the IND-CCA security of the TLS encryption scheme.

Thus, confidentiality holds.

### **6.2 Proof of Integrity**
#### **Theorem:**
No PPT adversary $( \mathcal{A}_{\mathsf{active}} )$ can modify messages or commitments in $( \Pi_{zkTLS} )$ without breaking the collision resistance of $( H )$ or the soundness of zkProofs.

#### **Proof (by contradiction):**  
$$
\text{Assume } \mathcal{A}_{\mathsf{active}} \text{ modifies } m \text{ to } m' \text{ without detection.}
$$

- **Game $( G_0 )$:** Challenger commits to $( m )$ with $( CM = H(m) )$.
- **Game $( G_1 )$:** $( \mathcal{A}_{\mathsf{active}} )$ produces $( m' )$ and $( CM' )$ such that $( CM = CM' )$.

If $( CM = CM' )$ but $( m \neq m' )$, this breaks collision resistance of $( H )$.

Thus, integrity holds.

### **6.3 Proof of Authenticity**
#### **Theorem:**
No adversary $( \mathcal{A} )$ can forge $( m, \pi )$ without breaking TLS or zkProofs.

#### **Proof (by contradiction):**  
$$
\text{Assume } \mathcal{A} \text{ forges } \pi.
$$

- **Game $( G_0 )$:** Challenger provides $( m, CM, \pi )$.
- **Game $( G_1 )$:** $( \mathcal{A} )$ submits $( \pi' )$ accepted by the verifier.

If $( \mathcal{A} )$ succeeds, it breaks TLS integrity or zkProof soundness.

Thus, authenticity holds.

### **6.4 Proof of Collusion Resistance**
#### **Theorem:**
No adversary $( \mathcal{A}_{O} )$ can reconstruct $( m )$ by colluding with Oracle nodes without breaking the honest-majority assumption of MPC.

#### **Proof (by contradiction):**  
$$
\text{Assume } \mathcal{A}_{O} \text{ successfully reconstructs } m \text{ by colluding with Oracle nodes.}
$$

- **Game $( G_0 )$:** Challenger sets up an MPC instance with \( n \) parties, where at most \( t \) are corrupt.
- **Game $( G_1 )$:** $( \mathcal{A}_{O} )$ corrupts $( t )$ nodes, attempting to reconstruct $( m )$.

If $( \mathcal{A}_{O} )$ succeeds, it violates the honest-majority assumption, which states that as long as more than $( \frac{n}{2} )$ nodes remain honest, reconstruction is impossible.

Since the honest-majority assumption holds, no such $( \mathcal{A}_{O} )$ can exist.

### **6.5 Fake Key Reveal Attack**
**Theorem:**  
No PPT adversary can execute a fake key reveal attack on $\Pi_{zkTLS}$ without breaking A1, A2, or A3.

**Proof (by contradiction):**  
Assume there exists an adversary $\mathcal{A}$ that successfully performs a fake key reveal attack.

- $\mathcal{A}$ must either break TLS key exchange security (A1),
- or produce a collision in $H$ (A2),
- or generate a zkProof $\pi'$ without the correct witness (A3).

Since all assumptions hold, no such $\mathcal{A}$ can exist.

### **6.6 Replay Attack**
**Theorem:**  
$\Pi_{zkTLS}$ ensures resistance to replay attacks under assumptions A1 and A2.

**Proof (by contradiction):**  
Assume $\mathcal{A}_{\mathsf{active}}$ successfully replays a session.  
- If successful, it must bypass TLS session freshness checks (A1) or produce a collision in $H$ (A2).  
Since both A1 and A2 hold, no such $\mathcal{A}$ can exist.

### **6.7 Key Compromise Impersonation (KCI) Attack**
**Theorem:**  
$\Pi_{zkTLS}$ ensures resistance to KCI attacks under assumptions A1 and A4.

**Proof (by contradiction):**  
Assume $\mathcal{A}_{O}$ successfully impersonates a compromised party.  
- This implies breaking forward secrecy in TLS (A1) or compromising the MPC protocol for future sessions (A4).  
Since both hold, no such $\mathcal{A}$ can exist.

### **6.8 Downgrade Attack**
**Theorem:**  
$\Pi_{zkTLS}$ ensures resistance to downgrade attacks under assumptions A1 and A3.

**Proof (by contradiction):**  
Assume $\mathcal{A}_{\mathsf{active}}$ successfully forces a downgrade.  
- This implies bypassing the cryptographic suite integrity checks in TLS (A1) or forging proof of a weaker suite handshake (A3).  
Since both hold, no such $\mathcal{A}$ can exist.

### **6.9 Oracle Manipulation Attack**
**Theorem:**  
$\Pi_{zkTLS}$ ensures resistance to Oracle Manipulation attacks under assumptions A3 and A4.

**Proof (by contradiction):**  
Assume $\mathcal{A}_{O}$ successfully manipulates the Oracle.  
- If successful, $\mathcal{A}_{O}$ must forge a zkProof without a valid witness (

---

