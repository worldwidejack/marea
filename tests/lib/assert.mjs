export class TestFail extends Error {}
const assert = (cond, msg) => { if (!cond) throw new TestFail(msg || 'assert'); };
assert.TestFail = TestFail;
assert.equal = (a, b, msg) => { if (a !== b) throw new TestFail(`${msg || 'equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };
assert.ok = assert;
export default assert;
