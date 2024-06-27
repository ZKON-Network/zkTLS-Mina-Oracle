use std::{str, time::Duration};

use elliptic_curve::pkcs8::DecodePublicKey;

use tlsn_core::proof::{SessionProof, TlsProof};

use neon::prelude::*;

fn verify(mut cx: FunctionContext) -> JsResult<JsObject> {
    // Deserialize the proof
    let proof = cx.argument::<JsString>(0)?.value(&mut cx);
    let proof: TlsProof = serde_json::from_str(proof.as_str()).unwrap();
    let notaryKeyCx = cx.argument::<JsString>(1)?.value(&mut cx);

    let TlsProof {
        // The session proof establishes the identity of the server and the commitments
        // to the TLS transcript.
        session,
        // The substrings proof proves select portions of the transcript, while redacting
        // anything the Prover chose not to disclose.
        substrings,
    } = proof;
    // Verify the session proof against the Notary's public key
    //
    // This verifies the identity of the server using a default certificate verifier which trusts
    // the root certificates from the `webpki-roots` crate.
    session
        .verify_with_default_cert_verifier(notary_pubkey(&notaryKeyCx))
        .unwrap();

    let SessionProof {
        // The session header that was signed by the Notary is a succinct commitment to the TLS transcript.
        header,
        // This is the session_info, which contains the server_name, that is checked against the
        // certificate chain shared in the TLS handshake.
        session_info,
        ..
    } = session;

    // The time at which the session was recorded
    let time = chrono::DateTime::UNIX_EPOCH + Duration::from_secs(header.time());

    // Verify the substrings proof against the session header.
    //
    // This returns the redacted transcripts
    let (mut sent, mut recv) = substrings.verify(&header).unwrap();

    // Replace the bytes which the Prover chose not to disclose with 'X'
    sent.set_redacted(b'X');
    recv.set_redacted(b'X');

    let obj: Handle<JsObject> = cx.empty_object();

    let sentStr = cx.string(String::from_utf8(sent.data().to_vec()).unwrap());
    let recvStr = cx.string(String::from_utf8(recv.data().to_vec()).unwrap());
    let sessionTime = cx.number(header.time() as f64);
    obj.set(&mut cx, "sent", sentStr)?;
    obj.set(&mut cx, "recv", recvStr)?;
    obj.set(&mut cx, "time", sessionTime)?;

    Ok(obj)
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("verify", verify)?;
    Ok(())
}

/// Returns a Notary pubkey trusted by this Verifier
fn notary_pubkey(key: &str) -> p256::PublicKey {
    p256::PublicKey::from_public_key_pem(key).unwrap()
}
