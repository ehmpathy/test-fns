/**
 * sanity check that unit tests are only run in 'test' environment
 * - if they are run in prod environment, we could load a bunch of junk data into our prod databases, which would be no bueno
 */
if (
  (process.env.NODE_ENV !== 'test' || process.env.STAGE) &&
  process.env.I_KNOW_WHAT_IM_DOING !== 'true'
)
  throw new Error(`unit-test is not targeting stage 'test'`);
