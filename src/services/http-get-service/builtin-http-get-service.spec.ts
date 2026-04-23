import { expect } from 'chai';
import { BuiltinHttpGetService } from './builtin-http-get-service.js';

describe('BuiltinHttpGetService', () => {
  it('returns an HttpGetService interface', () => {
    const service = BuiltinHttpGetService();
    expect(service).to.have.property('get');
    expect(typeof service.get).to.equal('function');
  });

  // Note: Full fetch integration tests are covered by smoke tests
  // and registry handler tests using FakeHttpGetService.
});
