// const TEST_EMAIL = 'test@test.com';
// const TEST_PASS = 'test1234';

const { clearAllUsers, getLastSmsCode, getRandomPhoneNumber } = require('./helpers');

describe('auth() => Phone', function () {
  // Other platforms don't support phone auth
  if (Platform.other) {
    return;
  }

  describe('firebase v8 compatibility', function () {
    before(async function () {
      const { getApp } = modular;
      const { getAuth } = authModular;
      try {
        await clearAllUsers();
      } catch (e) {
        throw e;
      }
      getAuth(getApp()).settings.appVerificationDisabledForTesting = true;
      await Utils.sleep(50);
    });

    beforeEach(async function beforeEachTest() {
      // @ts-ignore
      globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

      if (firebase.auth().currentUser) {
        await firebase.auth().signOut();
        await Utils.sleep(50);
      }
    });

    afterEach(async function afterEachTest() {
      // @ts-ignore
      globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = false;
    });

    describe('signInWithPhoneNumber', function () {
      it('signs in with a valid code', async function () {
        const testPhone = getRandomPhoneNumber();
        const confirmResult = await firebase.auth().signInWithPhoneNumber(testPhone);
        confirmResult.verificationId.should.be.a.String();
        should.ok(confirmResult.verificationId.length, 'verificationId string should not be empty');
        confirmResult.confirm.should.be.a.Function();
        const lastSmsCode = await getLastSmsCode(testPhone);
        const userCredential = await confirmResult.confirm(lastSmsCode);
        userCredential.user.should.be.instanceOf(
          require('@react-native-firebase/auth/lib/User').default,
        );

        // Broken check, phone number is undefined
        // userCredential.user.phoneNumber.should.equal(TEST_PHONE_A);
      });

      it('errors on invalid code', async function () {
        const testPhone = getRandomPhoneNumber();
        const confirmResult = await firebase.auth().signInWithPhoneNumber(testPhone);
        confirmResult.verificationId.should.be.a.String();
        should.ok(confirmResult.verificationId.length, 'verificationId string should not be empty');
        confirmResult.confirm.should.be.a.Function();
        // Get the last SMS code just to make absolutely sure we don't accidentally use it
        const lastSmsCode = await getLastSmsCode(testPhone);
        await confirmResult
          .confirm(lastSmsCode === '000000' ? '111111' : '000000')
          .should.be.rejected();
        // TODO test error code and message

        // If you don't consume the valid code, then it sticks around
        await confirmResult.confirm(lastSmsCode);
      });
    });

    // TODO these are now heavily rate limited by Firebase so they fail often
    // or take minutes to complete each test.
    xdescribe('verifyPhoneNumber', function () {
      it('successfully verifies', async function () {
        const testPhone = getRandomPhoneNumber();
        const confirmResult = await firebase.auth().signInWithPhoneNumber(testPhone);
        const lastSmsCode = await getLastSmsCode(testPhone);
        await confirmResult.confirm(lastSmsCode);
        await firebase.auth().verifyPhoneNumber(testPhone, false, false);
      });

      it('uses the autoVerifyTimeout when a non boolean autoVerifyTimeoutOrForceResend is provided', async function () {
        const testPhone = getRandomPhoneNumber();
        const confirmResult = await firebase.auth().signInWithPhoneNumber(testPhone);
        const lastSmsCode = await getLastSmsCode(testPhone);
        await confirmResult.confirm(lastSmsCode);
        await firebase.auth().verifyPhoneNumber(testPhone, 0, false);
      });

      it('throws an error with an invalid on event', async function () {
        const testPhone = getRandomPhoneNumber();
        try {
          await firebase
            .auth()
            .verifyPhoneNumber(testPhone)
            .on('example', () => {});

          return Promise.reject(new Error('Did not throw Error.'));
        } catch (e) {
          e.message.should.containEql(
            "firebase.auth.PhoneAuthListener.on(*, _, _, _) 'event' must equal 'state_changed'.",
          );
          return Promise.resolve();
        }
      });

      it('throws an error with an invalid observer event', async function () {
        const testPhone = getRandomPhoneNumber();
        try {
          await firebase
            .auth()
            .verifyPhoneNumber(testPhone)
            .on('state_changed', null, null, () => {});

          return Promise.reject(new Error('Did not throw Error.'));
        } catch (e) {
          e.message.should.containEql(
            "firebase.auth.PhoneAuthListener.on(_, *, _, _) 'observer' must be a function.",
          );
          return Promise.resolve();
        }
      });

      it('successfully runs verification complete handler', async function () {
        const testPhone = getRandomPhoneNumber();
        const thenCb = sinon.spy();
        await firebase.auth().verifyPhoneNumber(testPhone).then(thenCb);
        thenCb.should.be.calledOnce();
        const successAuthSnapshot = thenCb.args[0][0];
        if (Platform.ios) {
          successAuthSnapshot.state.should.equal('sent');
        } else {
          successAuthSnapshot.state.should.equal('timeout');
        }
      });

      it('successfully runs and calls success callback', async function () {
        const testPhone = getRandomPhoneNumber();
        const successCb = sinon.spy();
        const observerCb = sinon.spy();
        const errorCb = sinon.spy();

        await firebase
          .auth()
          .verifyPhoneNumber(testPhone)
          .on('state_changed', observerCb, errorCb, successCb);

        await Utils.spyToBeCalledOnceAsync(successCb);
        errorCb.should.be.callCount(0);
        successCb.should.be.calledOnce();
        let observerAuthSnapshot = observerCb.args[0][0];
        const successAuthSnapshot = successCb.args[0][0];
        successAuthSnapshot.verificationId.should.be.a.String();
        if (Platform.ios) {
          observerCb.should.be.calledOnce();
          successAuthSnapshot.state.should.equal('sent');
        } else {
          // android waits for SMS auto retrieval which does not work on an emulator
          // it gets a sent and a timeout message on observer, just the timeout on success
          observerCb.should.be.calledTwice();
          observerAuthSnapshot = observerCb.args[1][0];
          successAuthSnapshot.state.should.equal('timeout');
        }
        JSON.stringify(successAuthSnapshot).should.equal(JSON.stringify(observerAuthSnapshot));
      });

      // TODO determine why this is not stable on the emulator, is it also not stable on real device?
      xit('successfully runs and calls error callback', async function () {
        const successCb = sinon.spy();
        const observerCb = sinon.spy();
        const errorCb = sinon.spy();

        await firebase
          .auth()
          .verifyPhoneNumber('notaphonenumber')
          .on('state_changed', observerCb, errorCb, successCb);

        await Utils.spyToBeCalledOnceAsync(errorCb);
        errorCb.should.be.calledOnce();
        observerCb.should.be.calledOnce();
        // const observerEvent = observerCb.args[0][0];
        successCb.should.be.callCount(0);
        // const errorEvent = errorCb.args[0][0];
        // errorEvent.error.should.containEql('auth/invalid-phone-number');
        // JSON.stringify(errorEvent).should.equal(JSON.stringify(observerEvent));
      });

      it('catches an error and emits an error event', async function () {
        const catchCb = sinon.spy();
        await firebase.auth().verifyPhoneNumber('badphonenumber').catch(catchCb);
        catchCb.should.be.calledOnce();
      });
    });
  });

  describe('modular', function () {
    before(async function () {
      const { getApp } = modular;
      const { getAuth } = authModular;
      const defaultAuth = getAuth(getApp());

      try {
        await clearAllUsers();
      } catch (e) {
        throw e;
      }
      defaultAuth.settings.appVerificationDisabledForTesting = true;
      await Utils.sleep(50);
    });

    beforeEach(async function () {
      const { getApp } = modular;
      const { getAuth, signOut } = authModular;
      const defaultAuth = getAuth(getApp());

      if (defaultAuth.currentUser) {
        await signOut(defaultAuth);
        await Utils.sleep(50);
      }
    });

    describe('signInWithPhoneNumber', function () {
      it('signs in with a valid code', async function () {
        const { getApp } = modular;
        const { getAuth, signInWithPhoneNumber } = authModular;

        const defaultAuth = getAuth(getApp());

        const testPhone = getRandomPhoneNumber();
        const confirmResult = await signInWithPhoneNumber(defaultAuth, testPhone);
        confirmResult.verificationId.should.be.a.String();
        should.ok(confirmResult.verificationId.length, 'verificationId string should not be empty');
        confirmResult.confirm.should.be.a.Function();
        const lastSmsCode = await getLastSmsCode(testPhone);
        const userCredential = await confirmResult.confirm(lastSmsCode);
        userCredential.user.should.be.instanceOf(
          require('@react-native-firebase/auth/lib/User').default,
        );

        // Broken check, phone number is undefined
        // userCredential.user.phoneNumber.should.equal(TEST_PHONE_A);
      });

      it('errors on invalid code', async function () {
        const { getApp } = modular;
        const { getAuth, signInWithPhoneNumber } = authModular;

        const defaultAuth = getAuth(getApp());

        const testPhone = getRandomPhoneNumber();
        const confirmResult = await signInWithPhoneNumber(defaultAuth, testPhone);
        confirmResult.verificationId.should.be.a.String();
        should.ok(confirmResult.verificationId.length, 'verificationId string should not be empty');
        confirmResult.confirm.should.be.a.Function();
        // Get the last SMS code just to make absolutely sure we don't accidentally use it
        const lastSmsCode = await getLastSmsCode(testPhone);
        await confirmResult
          .confirm(lastSmsCode === '000000' ? '111111' : '000000')
          .should.be.rejected();
        // TODO test error code and message

        // If you don't consume the valid code, then it sticks around
        await confirmResult.confirm(lastSmsCode);
      });
    });

    // Note: verifyPhoneNumber is not available in the Firebase v9 API. The following tests need to be updated to use the new API.
    // TODO these are now heavily rate limited by Firebase so they fail often
    // or take minutes to complete each test.
    xdescribe('verifyPhoneNumber', function () {
      it('successfully verifies', async function () {
        const { getApp } = modular;
        const { getAuth, signInWithPhoneNumber, verifyPhoneNumber } = authModular;

        const defaultApp = getApp();
        const defaultAuth = getAuth(defaultApp);

        const testPhone = getRandomPhoneNumber();
        const confirmResult = await signInWithPhoneNumber(defaultAuth, testPhone);
        const lastSmsCode = await getLastSmsCode(testPhone);
        await confirmResult.confirm(lastSmsCode);
        await verifyPhoneNumber(defaultAuth, testPhone, false, false);
      });

      it('uses the autoVerifyTimeout when a non boolean autoVerifyTimeoutOrForceResend is provided', async function () {
        const { getApp } = modular;
        const { getAuth, signInWithPhoneNumber, verifyPhoneNumber } = authModular;

        const defaultApp = getApp();
        const defaultAuth = getAuth(defaultApp);
        const testPhone = getRandomPhoneNumber();
        const confirmResult = await signInWithPhoneNumber(defaultAuth, testPhone);
        const lastSmsCode = await getLastSmsCode(testPhone);
        await confirmResult.confirm(lastSmsCode);
        await verifyPhoneNumber(defaultAuth, testPhone, 0, false);
      });

      it('throws an error with an invalid on event', async function () {
        const { getAuth, verifyPhoneNumber } = authModular;

        const auth = getAuth();
        const testPhone = getRandomPhoneNumber();

        try {
          await verifyPhoneNumber(auth, testPhone).on('example', () => {});

          return Promise.reject(new Error('Did not throw Error.'));
        } catch (e) {
          e.message.should.containEql(
            "firebase.auth.PhoneAuthListener.on(*, _, _, _) 'event' must equal 'state_changed'.",
          );
          return Promise.resolve();
        }
      });

      it('throws an error with an invalid observer event', async function () {
        const { getApp } = modular;
        const { getAuth, verifyPhoneNumber } = authModular;

        const defaultApp = getApp();
        const defaultAuth = getAuth(defaultApp);

        const testPhone = getRandomPhoneNumber();
        try {
          await verifyPhoneNumber(defaultAuth, testPhone).on('state_changed', null, null, () => {});

          return Promise.reject(new Error('Did not throw Error.'));
        } catch (e) {
          e.message.should.containEql(
            "firebase.auth.PhoneAuthListener.on(_, *, _, _) 'observer' must be a function.",
          );
          return Promise.resolve();
        }
      });

      it('successfully runs verification complete handler', async function () {
        const { getApp } = modular;
        const { getAuth, verifyPhoneNumber } = authModular;

        const defaultApp = getApp();
        const defaultAuth = getAuth(defaultApp);

        const testPhone = getRandomPhoneNumber();
        const thenCb = sinon.spy();
        await verifyPhoneNumber(defaultAuth, testPhone).then(thenCb);
        thenCb.should.be.calledOnce();
        const successAuthSnapshot = thenCb.args[0][0];
        if (Platform.ios) {
          successAuthSnapshot.state.should.equal('sent');
        } else {
          successAuthSnapshot.state.should.equal('timeout');
        }
      });

      it('successfully runs and calls success callback', async function () {
        const { getApp } = modular;
        const { getAuth, verifyPhoneNumber } = authModular;

        const defaultApp = getApp();
        const defaultAuth = getAuth(defaultApp);

        const testPhone = getRandomPhoneNumber();
        const successCb = sinon.spy();
        const observerCb = sinon.spy();
        const errorCb = sinon.spy();

        await verifyPhoneNumber(defaultAuth, testPhone).on(
          'state_changed',
          observerCb,
          errorCb,
          successCb,
        );

        await Utils.spyToBeCalledOnceAsync(successCb);
        errorCb.should.be.callCount(0);
        successCb.should.be.calledOnce();
        let observerAuthSnapshot = observerCb.args[0][0];
        const successAuthSnapshot = successCb.args[0][0];
        successAuthSnapshot.verificationId.should.be.a.String();
        if (Platform.ios) {
          observerCb.should.be.calledOnce();
          successAuthSnapshot.state.should.equal('sent');
        } else {
          // android waits for SMS auto retrieval which does not work on an emulator
          // it gets a sent and a timeout message on observer, just the timeout on success
          observerCb.should.be.calledTwice();
          observerAuthSnapshot = observerCb.args[1][0];
          successAuthSnapshot.state.should.equal('timeout');
        }
        JSON.stringify(successAuthSnapshot).should.equal(JSON.stringify(observerAuthSnapshot));
      });

      // TODO determine why this is not stable on the emulator, is it also not stable on real device?
      xit('successfully runs and calls error callback', async function () {
        const { getApp } = modular;
        const { getAuth, verifyPhoneNumber } = authModular;

        const defaultApp = getApp();
        const defaultAuth = getAuth(defaultApp);

        const successCb = sinon.spy();
        const observerCb = sinon.spy();
        const errorCb = sinon.spy();

        await verifyPhoneNumber(defaultAuth, 'notaphonenumber').on(
          'state_changed',
          observerCb,
          errorCb,
          successCb,
        );

        await Utils.spyToBeCalledOnceAsync(errorCb);
        errorCb.should.be.calledOnce();
        observerCb.should.be.calledOnce();
        // const observerEvent = observerCb.args[0][0];
        successCb.should.be.callCount(0);
        // const errorEvent = errorCb.args[0][0];
        // errorEvent.error.should.containEql('auth/invalid-phone-number');
        // JSON.stringify(errorEvent).should.equal(JSON.stringify(observerEvent));
      });

      it('catches an error and emits an error event', async function () {
        const { getApp } = modular;
        const { getAuth, verifyPhoneNumber } = authModular;

        const defaultApp = getApp();
        const defaultAuth = getAuth(defaultApp);

        const catchCb = sinon.spy();
        await verifyPhoneNumber(defaultAuth, 'badphonenumber').catch(catchCb);
        catchCb.should.be.calledOnce();
      });
    });
  });
});
