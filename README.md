# Compiling the Verifier module

Navigate to `/verifier`, and run `npm build`. This is an essential step for the entire flow to compile. 

# How to run?

`npm run watch` to run index.ts in watch mode. 
**warning** 
Disable the SSL Check agent before actual production use.

# ToDo

- [ ] Change the TLSNotary-Cleint Endpoint.
- [ ] Accomodate zkProgram changes
- [ ] Fix the commiment scheme, to make a uniform proof irrespective of data-source Endpoint.
- [ ] Change TLSNotary Client to accomodate generic data-source URLs. 
- [ ] Use RequestObject to handle the axios requests.
