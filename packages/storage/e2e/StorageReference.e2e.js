/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { PATH, seed, WRITE_ONLY_NAME } = require('./helpers');

describe('storage() -> StorageReference', function () {
  describe('firebase v8 compatibility', function () {
    before(async function () {
      await seed(PATH);

      // @ts-ignore
      globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;
    });

    after(async function afterEachTest() {
      // @ts-ignore
      globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = false;
    });

    describe('toString()', function () {
      it('returns the correct bucket path to the file', function () {
        const app = firebase.app();
        firebase
          .storage()
          .ref('/uploadNope.jpeg')
          .toString()
          .should.equal(`gs://${app.options.storageBucket}/uploadNope.jpeg`);
      });
    });

    describe('properties', function () {
      describe('fullPath', function () {
        it('returns the full path as a string', function () {
          firebase
            .storage()
            .ref('/foo/uploadNope.jpeg')
            .fullPath.should.equal('foo/uploadNope.jpeg');
          firebase
            .storage()
            .ref('foo/uploadNope.jpeg')
            .fullPath.should.equal('foo/uploadNope.jpeg');
        });
      });

      describe('storage', function () {
        it('returns the instance of storage', function () {
          firebase.storage().ref('/foo/uploadNope.jpeg').storage.ref.should.be.a.Function();
        });
      });

      describe('bucket', function () {
        it('returns the storage bucket as a string', function () {
          const app = firebase.app();
          firebase
            .storage()
            .ref('/foo/uploadNope.jpeg')
            .bucket.should.equal(app.options.storageBucket);
        });
      });

      describe('name', function () {
        it('returns the file name as a string', function () {
          const ref = firebase.storage().ref('/foo/uploadNope.jpeg');
          ref.name.should.equal('uploadNope.jpeg');
        });
      });

      describe('parent', function () {
        it('returns the parent directory as a reference', function () {
          firebase.storage().ref('/foo/uploadNope.jpeg').parent.fullPath.should.equal('foo');
        });

        it('returns null if already at root', function () {
          const ref = firebase.storage().ref('/');
          should.equal(ref.parent, null);
        });
      });

      describe('root', function () {
        it('returns a reference to the root of the bucket', function () {
          firebase.storage().ref('/foo/uploadNope.jpeg').root.fullPath.should.equal('/');
        });
      });
    });

    describe('child()', function () {
      it('returns a reference to a child path', function () {
        const parentRef = firebase.storage().ref('/foo');
        const childRef = parentRef.child('someFile.json');
        childRef.fullPath.should.equal('foo/someFile.json');
      });
    });

    describe('delete()', function () {
      it('should delete a file', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/deleteMe.txt`);
        await storageReference.putString('Delete File');
        await storageReference.delete();
        try {
          await storageReference.getMetadata();
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/object-not-found');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/object-not-found] No object exists at the desired reference.',
            );
          }
          return Promise.resolve();
        }
      });

      it('throws error if file does not exist', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/iDoNotExist.txt`);

        try {
          await storageReference.delete();
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/object-not-found');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/object-not-found] No object exists at the desired reference.',
            );
          }
          return Promise.resolve();
        }
      });

      it('throws error if no write permission', async function () {
        const storageReference = firebase.storage().ref('/uploadNope.jpeg');

        try {
          await storageReference.delete();
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/unauthorized');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/unauthorized] User is not authorized to perform the desired action.',
            );
          }
          return Promise.resolve();
        }
      });
    });

    describe('getDownloadURL', function () {
      it('should return a download url for a file', async function () {
        // This is frequently flaky in CI - but works sometimes. Skipping only in CI for now.
        if (!isCI) {
          const storageReference = firebase.storage().ref(`${PATH}/list/file1.txt`);
          const downloadUrl = await storageReference.getDownloadURL();
          downloadUrl.should.be.a.String();
          downloadUrl.should.containEql('file1.txt');
          downloadUrl.should.containEql(firebase.app().options.projectId);
        } else {
          this.skip();
        }
      });

      it('throws error if file does not exist', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/iDoNotExist.txt`);
        try {
          await storageReference.getDownloadURL();
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/object-not-found');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/object-not-found] No object exists at the desired reference.',
            );
          }
          return Promise.resolve();
        }
      });

      it('throws error if no read permission', async function () {
        const storageReference = firebase.storage().ref(WRITE_ONLY_NAME);
        try {
          await storageReference.getDownloadURL();
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/unauthorized');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/unauthorized] User is not authorized to perform the desired action.',
            );
          }
          return Promise.resolve();
        }
      });
    });

    describe('getMetadata', function () {
      it('should return a metadata for a file', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/list/file1.txt`);
        const metadata = await storageReference.getMetadata();
        metadata.generation.should.be.a.String();
        metadata.fullPath.should.equal(`${PATH}/list/file1.txt`);
        if (Platform.android || Platform.other) {
          metadata.name.should.equal('file1.txt');
        } else {
          // FIXME on ios file comes through as fully-qualified
          // https://github.com/firebase/firebase-ios-sdk/issues/9849#issuecomment-1159819958
          metadata.name.should.equal(`${PATH}/list/file1.txt`);
        }
        metadata.size.should.be.a.Number();
        should.equal(metadata.size > 0, true);
        metadata.updated.should.be.a.String();
        metadata.timeCreated.should.be.a.String();
        metadata.contentEncoding.should.be.a.String();
        metadata.contentDisposition.should.be.a.String();
        metadata.contentType.should.equal('text/plain');
        metadata.bucket.should.equal(`${firebase.app().options.projectId}.appspot.com`);
        metadata.metageneration.should.be.a.String();
        metadata.md5Hash.should.be.a.String();
        // TODO against cloud storage cacheControl comes back null/undefined by default. Emulator has a difference
        // https://github.com/firebase/firebase-tools/issues/3398#issuecomment-1159821364
        // should.equal(metadata.cacheControl, undefined);
        should.equal(metadata.contentLanguage, null);
        // should.equal(metadata.customMetadata, null);
      });
    });

    describe('list', function () {
      it('should return list results', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/list`);
        const result = await storageReference.list();
        result.constructor.name.should.eql('StorageListResult');
        result.should.have.property('nextPageToken');
        result.items.should.be.Array();
        result.items.length.should.be.greaterThan(0);
        result.items[0].constructor.name.should.eql('StorageReference');
        result.prefixes.should.be.Array();
        result.prefixes.length.should.be.greaterThan(0);
        result.prefixes[0].constructor.name.should.eql('StorageReference');
      });

      it('throws if options is not an object', function () {
        try {
          const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
          storageReference.list(123);
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.message.should.containEql("'options' expected an object value");
          return Promise.resolve();
        }
      });

      describe('maxResults', function () {
        it('should limit with maxResults are passed', async function () {
          const storageReference = firebase.storage().ref(`${PATH}/list`);
          const result = await storageReference.list({
            maxResults: 1,
          });
          result.nextPageToken.should.be.String();
          result.items.should.be.Array();
          result.items.length.should.eql(1);
          result.items[0].constructor.name.should.eql('StorageReference');
          result.prefixes.should.be.Array();
          // todo length?
        });

        it('throws if maxResults is not a number', function () {
          try {
            const storageReference = firebase.storage().ref(`${PATH}/list`);
            storageReference.list({
              maxResults: '123',
            });
            return Promise.reject(new Error('Did not throw'));
          } catch (error) {
            error.message.should.containEql("'options.maxResults' expected a number value");
            return Promise.resolve();
          }
        });

        it('throws if maxResults is not a valid number', function () {
          try {
            const storageReference = firebase.storage().ref(`${PATH}/list`);
            storageReference.list({
              maxResults: 2000,
            });
            return Promise.reject(new Error('Did not throw'));
          } catch (error) {
            error.message.should.containEql(
              "'options.maxResults' expected a number value between 1-1000",
            );
            return Promise.resolve();
          }
        });
      });

      describe('pageToken', function () {
        it('throws if pageToken is not a string', function () {
          try {
            const storageReference = firebase.storage().ref(`${PATH}/list`);
            storageReference.list({
              pageToken: 123,
            });
            return Promise.reject(new Error('Did not throw'));
          } catch (error) {
            error.message.should.containEql("'options.pageToken' expected a string value");
            return Promise.resolve();
          }
        });

        it('should return and use a page token', async function () {
          const storageReference = firebase.storage().ref(`${PATH}/list`);
          const result1 = await storageReference.list({
            maxResults: 1,
          });
          const item1 = result1.items[0].fullPath;
          const result2 = await storageReference.list({
            maxResults: 1,
            pageToken: result1.nextPageToken,
          });
          const item2 = result2.items[0].fullPath;
          if (item1 === item2) {
            throw new Error('Expected item results to be different.');
          }
        });
      });
    });

    describe('listAll', function () {
      it('should return all results', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/list`);
        const result = await storageReference.listAll();
        should.equal(result.nextPageToken, null);
        result.items.should.be.Array();
        result.items.length.should.be.greaterThan(0);
        result.items[0].constructor.name.should.eql('StorageReference');
        result.prefixes.should.be.Array();
        result.prefixes.length.should.be.greaterThan(0);
        result.prefixes[0].constructor.name.should.eql('StorageReference');
      });

      it('should not crash if the user is not allowed to list the directory', async function () {
        const storageReference = firebase.storage().ref('/forbidden');
        try {
          await storageReference.listAll();
          return Promise.reject(new Error('listAll on a forbidden directory succeeded'));
        } catch (error) {
          error.code.should.equal('storage/unauthorized');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/unauthorized] User is not authorized to perform the desired action.',
            );
          }
          return Promise.resolve();
        }
      });
    });

    describe('updateMetadata', function () {
      it('should return the updated metadata for a file', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/list/file1.txt`);
        let metadata = await storageReference.updateMetadata({
          cacheControl: 'cache-control',
          contentDisposition: 'content-disposition',
          contentEncoding: 'application/octet-stream',
          contentLanguage: 'de',
          contentType: 'content-type-a',
          customMetadata: {
            a: 'b',
            y: 'z',
          },
        });
        // Things that are set automagically for us
        metadata.generation.should.be.a.String();
        metadata.fullPath.should.equal(`${PATH}/list/file1.txt`);
        if (Platform.android || Platform.other) {
          metadata.name.should.equal('file1.txt');
        } else {
          // FIXME on ios file comes through as fully-qualified
          // https://github.com/firebase/firebase-ios-sdk/issues/9849#issuecomment-1159819958
          metadata.name.should.equal(`${PATH}/list/file1.txt`);
        }
        metadata.size.should.be.a.Number();
        should.equal(metadata.size > 0, true);
        metadata.updated.should.be.a.String();
        metadata.timeCreated.should.be.a.String();
        metadata.metageneration.should.be.a.String();
        metadata.md5Hash.should.be.a.String();
        metadata.bucket.should.equal(`${firebase.app().options.projectId}.appspot.com`);
        // Things we just updated
        metadata.cacheControl.should.equals('cache-control');
        metadata.contentDisposition.should.equal('content-disposition');
        metadata.contentEncoding.should.equal('application/octet-stream');
        metadata.contentLanguage.should.equal('de');
        metadata.contentType.should.equal('content-type-a');
        metadata.customMetadata.should.be.an.Object();
        metadata.customMetadata.a.should.equal('b');
        metadata.customMetadata.y.should.equal('z');
        Object.keys(metadata.customMetadata).length.should.equal(2);
        // Now let's make sure removing metadata works
        metadata = await storageReference.updateMetadata({
          contentType: null,
          cacheControl: null,
          contentDisposition: null,
          contentEncoding: null,
          contentLanguage: null,
          customMetadata: null,
        });
        // Things that are set automagically for us and are not updatable
        metadata.generation.should.be.a.String();
        metadata.fullPath.should.equal(`${PATH}/list/file1.txt`);
        if (Platform.android || Platform.other) {
          metadata.name.should.equal('file1.txt');
        } else {
          // FIXME on ios file comes through as fully-qualified
          // https://github.com/firebase/firebase-ios-sdk/issues/9849#issuecomment-1159819958
          metadata.name.should.equal(`${PATH}/list/file1.txt`);
        }
        metadata.size.should.be.a.Number();
        should.equal(metadata.size > 0, true);
        metadata.updated.should.be.a.String();
        metadata.timeCreated.should.be.a.String();
        metadata.metageneration.should.be.a.String();
        metadata.md5Hash.should.be.a.String();
        metadata.bucket.should.equal(`${firebase.app().options.projectId}.appspot.com`);
        // Things that we may set (or remove)
        should.equal(metadata.cacheControl, undefined);
        should.equal(metadata.contentDisposition, undefined);
        should.equal(metadata.contentEncoding, 'identity');
        should.equal(metadata.contentLanguage, undefined);
        should.equal(metadata.contentType, undefined);
        should.equal(metadata.customMetadata, undefined);
      });

      it('should set update or remove customMetadata properties correctly', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/list/file1.txt`);
        let metadata = await storageReference.updateMetadata({
          contentType: 'application/octet-stream',
          customMetadata: {
            keepMe: 'please',
            removeMeFirstTime: 'please',
            removeMeSecondTime: 'please',
          },
        });
        Object.keys(metadata.customMetadata).length.should.equal(3);
        metadata.customMetadata.keepMe.should.equal('please');
        metadata.customMetadata.removeMeFirstTime.should.equal('please');
        metadata.customMetadata.removeMeSecondTime.should.equal('please');
        metadata = await storageReference.updateMetadata({
          contentType: 'application/octet-stream',
          customMetadata: {
            keepMe: 'please',
            removeMeFirstTime: null,
            removeMeSecondTime: 'please',
          },
        });
        Object.keys(metadata.customMetadata).length.should.equal(2);
        metadata.customMetadata.keepMe.should.equal('please');
        metadata.customMetadata.removeMeSecondTime.should.equal('please');
        metadata = await storageReference.updateMetadata({
          contentType: 'application/octet-stream',
          customMetadata: {
            keepMe: 'please',
            removeMeSecondTime: null,
          },
        });
        Object.keys(metadata.customMetadata).length.should.equal(1);
        metadata.customMetadata.keepMe.should.equal('please');
      });

      it('should error if updateMetadata includes md5hash', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/list/file1.txt`);
        try {
          await storageReference.updateMetadata({
            md5hash: '0xDEADBEEF',
          });
          return Promise.reject(new Error('Did not throw on invalid updateMetadata'));
        } catch (e) {
          e.message.should.containEql('md5hash may only be set on upload, not on updateMetadata');
          return Promise.resolve();
        }
      });
    });

    describe('putFile', function () {
      it('errors if file path is not a string', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.putFile(1337);
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('expects a string value');
          return Promise.resolve();
        }
      });

      it('errors if metadata is not an object', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.putFile('foo', 123);
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('must be an object value');
          return Promise.resolve();
        }
      });

      it('errors if metadata contains an unsupported property', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.putFile('foo', { foo: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql("unknown property 'foo'");
          return Promise.resolve();
        }
      });

      it('errors if metadata property value is not a string or null value', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.putFile('foo', { contentType: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('should be a string or null value');
          return Promise.resolve();
        }
      });

      it('errors if metadata.customMetadata is not an object', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.putFile('foo', { customMetadata: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql(
            'customMetadata must be an object of keys and string values',
          );
          return Promise.resolve();
        }
      });
      // TODO check an metaData:md5hash property passes through correcty on putFile
    });

    describe('putString', function () {
      it('errors if metadata is not an object', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.putString('foo', 'raw', 123);
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('must be an object value');
          return Promise.resolve();
        }
      });

      it('errors if metadata contains an unsupported property', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.putString('foo', 'raw', { foo: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql("unknown property 'foo'");
          return Promise.resolve();
        }
      });

      it('errors if metadata property value is not a string or null value', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.putString('foo', 'raw', { contentType: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('should be a string or null value');
          return Promise.resolve();
        }
      });

      it('errors if metadata.customMetadata is not an object', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.putString('foo', 'raw', { customMetadata: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql(
            'customMetadata must be an object of keys and string values',
          );
          return Promise.resolve();
        }
      });

      it('allows valid metadata properties for upload', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/metadataTest.txt`);
        await storageReference.putString('foo', 'raw', {
          contentType: 'text/plain',
          md5hash: '123412341234',
          cacheControl: 'true',
          contentDisposition: 'disposed',
          contentEncoding: 'application/octet-stream',
          contentLanguage: 'de',
          customMetadata: {
            customMetadata1: 'metadata1value',
          },
        });
      });
    });

    describe('put', function () {
      it('errors if metadata is not an object', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.put(new ArrayBuffer(), 123);
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('must be an object value');
          return Promise.resolve();
        }
      });

      it('errors if metadata contains an unsupported property', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.put(new ArrayBuffer(), { foo: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql("unknown property 'foo'");
          return Promise.resolve();
        }
      });

      it('errors if metadata property value is not a string or null value', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.put(new ArrayBuffer(), { contentType: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('should be a string or null value');
          return Promise.resolve();
        }
      });

      it('errors if metadata.customMetadata is not an object', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/ok.jpeg`);
        try {
          storageReference.put(new ArrayBuffer(), { customMetadata: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql(
            'customMetadata must be an object of keys and string values',
          );
          return Promise.resolve();
        }
      });

      it('allows valid metadata properties for upload', async function () {
        const storageReference = firebase.storage().ref(`${PATH}/metadataTest.jpeg`);
        await storageReference.put(new ArrayBuffer(), {
          contentType: 'image/jpg',
          md5hash: '123412341234',
          cacheControl: 'true',
          contentDisposition: 'disposed',
          contentEncoding: 'application/octet-stream',
          contentLanguage: 'de',
          customMetadata: {
            customMetadata1: 'metadata1value',
          },
        });
      });
    });

    describe('put secondaryApp', function () {
      it('allows valid metadata properties for upload', async function () {
        const storageReference = firebase
          .storage(firebase.app('secondaryFromNative'))
          // .storage()
          .ref(`${PATH}/metadataTest.jpeg`);
        await storageReference.put(new ArrayBuffer(), {
          contentType: 'image/jpg',
          md5hash: '123412341234',
          cacheControl: 'true',
          contentDisposition: 'disposed',
          contentEncoding: 'application/octet-stream',
          contentLanguage: 'de',
          customMetadata: {
            customMetadata1: 'metadata1value',
          },
        });
      });
    });
  });

  describe('StorageReference modular', function () {
    let secondStorage;
    const secondStorageBucket = 'gs://react-native-firebase-testing';

    before(async function () {
      await seed(PATH);

      const { getApp } = modular;
      const { getStorage } = storageModular;
      secondStorage = getStorage(getApp(), secondStorageBucket);
    });

    describe('second storage bucket writes to Storage emulator', function () {
      // Same bucket defined in app.js when setting up emulator

      it('should write a file to the second storage bucket', async function () {
        const { ref, uploadString } = storageModular;

        // "only-second-bucket" is not an allowable path on live project for either bucket
        const storageReference = ref(secondStorage, 'only-second-bucket/ok.txt');

        await uploadString(storageReference, 'Hello World');
      });

      it('should throw exception on path not allowed on second bucket security rules', async function () {
        const { ref, uploadString } = storageModular;

        // "react-native-firebase-testing" is not an allowed on second bucket, only "ony-second-bucket"
        const storageReference = ref(
          secondStorage,
          'react-native-firebase-testing/should-fail.txt',
        );

        try {
          await uploadString(storageReference, 'Hello World');
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/unauthorized');
          return Promise.resolve();
        }
      });
    });

    describe('toString()', function () {
      it('returns the correct bucket path to the file', function () {
        const { getApp } = modular;
        const { getStorage, ref, toString } = storageModular;
        const storageReference = ref(getStorage(), `/uploadNope.jpeg`);

        toString(storageReference).should.equal(
          `gs://${getApp().options.storageBucket}/uploadNope.jpeg`,
        );
      });
    });

    describe('properties', function () {
      describe('fullPath', function () {
        it('returns the full path as a string', function () {
          const { getStorage, ref } = storageModular;
          const storageReference = ref(getStorage(), '/foo/uploadNope.jpeg');
          const storageReference2 = ref(getStorage(), 'foo/uploadNope.jpeg');
          storageReference.fullPath.should.equal('foo/uploadNope.jpeg');
          storageReference2.fullPath.should.equal('foo/uploadNope.jpeg');
        });
      });

      describe('storage', function () {
        it('returns the instance of storage', function () {
          const { getStorage, ref } = storageModular;
          const storageReference = ref(getStorage(), '/foo/uploadNope.jpeg');
          storageReference.storage.ref.should.be.a.Function();
        });
      });

      describe('bucket', function () {
        it('returns the storage bucket as a string', function () {
          const { getApp } = modular;
          const { getStorage, ref } = storageModular;
          const storageReference = ref(getStorage(), '/foo/uploadNope.jpeg');
          storageReference.bucket.should.equal(getApp().options.storageBucket);
        });
      });

      describe('name', function () {
        it('returns the file name as a string', function () {
          const { getStorage, ref } = storageModular;
          const storageReference = ref(getStorage(), '/foo/uploadNope.jpeg');

          storageReference.name.should.equal('uploadNope.jpeg');
        });
      });

      describe('parent', function () {
        it('returns the parent directory as a reference', function () {
          const { getStorage, ref } = storageModular;
          const storageReference = ref(getStorage(), '/foo/uploadNope.jpeg');
          storageReference.parent.fullPath.should.equal('foo');
        });

        it('returns null if already at root', function () {
          const { getStorage, ref } = storageModular;
          const storageReference = ref(getStorage(), '/');

          should.equal(storageReference.parent, null);
        });
      });

      describe('root', function () {
        it('returns a reference to the root of the bucket', function () {
          const { getStorage, ref } = storageModular;
          const storageReference = ref(getStorage(), '/foo/uploadNope.jpeg');
          storageReference.root.fullPath.should.equal('/');
        });
      });
    });

    describe('child()', function () {
      it('returns a reference to a child path', function () {
        const { getStorage, ref, child } = storageModular;
        const storageReference = ref(getStorage(), '/foo');

        const childRef = child(storageReference, 'someFile.json');
        childRef.fullPath.should.equal('foo/someFile.json');
      });
    });

    describe('delete()', function () {
      it('should delete a file', async function () {
        const { getStorage, ref, uploadString, deleteObject, getMetadata } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/deleteMe.txt`);

        await uploadString(storageReference, 'Delete File');
        await deleteObject(storageReference);

        try {
          await getMetadata(storageReference);
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/object-not-found');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/object-not-found] No object exists at the desired reference.',
            );
          }
          return Promise.resolve();
        }
      });

      it('throws error if file does not exist', async function () {
        const { getStorage, ref, deleteObject } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/iDoNotExist.txt`);

        try {
          await deleteObject(storageReference);
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/object-not-found');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/object-not-found] No object exists at the desired reference.',
            );
          }
          return Promise.resolve();
        }
      });

      it('throws error if no write permission', async function () {
        const { getStorage, ref, deleteObject } = storageModular;
        const storageReference = ref(getStorage(), '/uploadNope.jpeg');

        try {
          await deleteObject(storageReference);
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/unauthorized');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/unauthorized] User is not authorized to perform the desired action.',
            );
          }
          return Promise.resolve();
        }
      });
    });

    describe('getDownloadURL', function () {
      it('should return a download url for a file', async function () {
        const { getApp } = modular;
        const { getStorage, ref, getDownloadURL } = storageModular;
        // This is frequently flaky in CI - but works sometimes. Skipping only in CI for now.
        if (!isCI) {
          const storageReference = ref(getStorage(), `${PATH}/list/file1.txt`);
          const downloadUrl = await getDownloadURL(storageReference);
          downloadUrl.should.be.a.String();
          downloadUrl.should.containEql('file1.txt');
          downloadUrl.should.containEql(getApp().options.projectId);
        } else {
          this.skip();
        }
      });

      it('throws error if file does not exist', async function () {
        const { getStorage, ref, getDownloadURL } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/iDoNotExist.txt`);

        try {
          await getDownloadURL(storageReference);
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/object-not-found');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/object-not-found] No object exists at the desired reference.',
            );
          }
          return Promise.resolve();
        }
      });

      it('throws error if no read permission', async function () {
        const { getStorage, ref, getDownloadURL } = storageModular;
        const storageReference = ref(getStorage(), WRITE_ONLY_NAME);

        try {
          await getDownloadURL(storageReference);
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.code.should.equal('storage/unauthorized');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/unauthorized] User is not authorized to perform the desired action.',
            );
          }
          return Promise.resolve();
        }
      });
    });

    describe('getMetadata', function () {
      it('should return a metadata for a file', async function () {
        const { getApp } = modular;
        const { getStorage, ref, getMetadata } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/list/file1.txt`);
        const metadata = await getMetadata(storageReference);
        metadata.generation.should.be.a.String();
        metadata.fullPath.should.equal(`${PATH}/list/file1.txt`);
        if (Platform.android || Platform.other) {
          metadata.name.should.equal('file1.txt');
        } else {
          // FIXME on ios file comes through as fully-qualified
          // https://github.com/firebase/firebase-ios-sdk/issues/9849#issuecomment-1159819958
          metadata.name.should.equal(`${PATH}/list/file1.txt`);
        }
        metadata.size.should.be.a.Number();
        should.equal(metadata.size > 0, true);
        metadata.updated.should.be.a.String();
        metadata.timeCreated.should.be.a.String();
        metadata.contentEncoding.should.be.a.String();
        metadata.contentDisposition.should.be.a.String();
        metadata.contentType.should.equal('text/plain');
        metadata.bucket.should.equal(`${getApp().options.projectId}.appspot.com`);
        metadata.metageneration.should.be.a.String();
        metadata.md5Hash.should.be.a.String();
        // TODO against cloud storage cacheControl comes back null/undefined by default. Emulator has a difference
        // https://github.com/firebase/firebase-tools/issues/3398#issuecomment-1159821364
        // should.equal(metadata.cacheControl, undefined);
        should.equal(metadata.contentLanguage, null);
        // should.equal(metadata.customMetadata, null);
      });
    });

    describe('list', function () {
      it('should return list results', async function () {
        const { getStorage, ref, list } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/list`);

        const result = await list(storageReference);

        result.constructor.name.should.eql('StorageListResult');
        result.should.have.property('nextPageToken');

        result.items.should.be.Array();
        result.items.length.should.be.greaterThan(0);
        result.items[0].constructor.name.should.eql('StorageReference');

        result.prefixes.should.be.Array();
        result.prefixes.length.should.be.greaterThan(0);
        result.prefixes[0].constructor.name.should.eql('StorageReference');
      });

      it('throws if options is not an object', function () {
        try {
          const { getStorage, ref, list } = storageModular;
          const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
          list(storageReference, 123);
          return Promise.reject(new Error('Did not throw'));
        } catch (error) {
          error.message.should.containEql("'options' expected an object value");
          return Promise.resolve();
        }
      });

      describe('maxResults', function () {
        it('should limit with maxResults are passed', async function () {
          const { getStorage, ref, list } = storageModular;
          const storageReference = ref(getStorage(), `${PATH}/list`);

          const result = await list(storageReference, {
            maxResults: 1,
          });

          result.nextPageToken.should.be.String();

          result.items.should.be.Array();
          result.items.length.should.eql(1);
          result.items[0].constructor.name.should.eql('StorageReference');

          result.prefixes.should.be.Array();
          // todo length?
        });

        it('throws if maxResults is not a number', function () {
          try {
            const { getStorage, ref, list } = storageModular;
            const storageReference = ref(getStorage(), `${PATH}/list`);

            list(storageReference, {
              maxResults: '123',
            });
            return Promise.reject(new Error('Did not throw'));
          } catch (error) {
            error.message.should.containEql("'options.maxResults' expected a number value");
            return Promise.resolve();
          }
        });

        it('throws if maxResults is not a valid number', function () {
          try {
            const { getStorage, ref, list } = storageModular;
            const storageReference = ref(getStorage(), `${PATH}/list`);
            list(storageReference, {
              maxResults: 2000,
            });
            return Promise.reject(new Error('Did not throw'));
          } catch (error) {
            error.message.should.containEql(
              "'options.maxResults' expected a number value between 1-1000",
            );
            return Promise.resolve();
          }
        });
      });

      describe('pageToken', function () {
        it('throws if pageToken is not a string', function () {
          try {
            const { getStorage, ref, list } = storageModular;
            const storageReference = ref(getStorage(), `${PATH}/list`);
            list(storageReference, {
              pageToken: 123,
            });
            return Promise.reject(new Error('Did not throw'));
          } catch (error) {
            error.message.should.containEql("'options.pageToken' expected a string value");
            return Promise.resolve();
          }
        });

        it('should return and use a page token', async function () {
          const { getStorage, ref, list } = storageModular;
          const storageReference = ref(getStorage(), `${PATH}/list`);
          const result1 = await list(storageReference, {
            maxResults: 1,
          });

          const item1 = result1.items[0].fullPath;

          const result2 = await list(storageReference, {
            maxResults: 1,
            pageToken: result1.nextPageToken,
          });

          const item2 = result2.items[0].fullPath;

          if (item1 === item2) {
            throw new Error('Expected item results to be different.');
          }
        });
      });
    });

    describe('listAll', function () {
      it('should return all results', async function () {
        const { getStorage, ref, listAll } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/list`);
        const result = await listAll(storageReference);

        should.equal(result.nextPageToken, null);

        result.items.should.be.Array();
        result.items.length.should.be.greaterThan(0);
        result.items[0].constructor.name.should.eql('StorageReference');

        result.prefixes.should.be.Array();
        result.prefixes.length.should.be.greaterThan(0);
        result.prefixes[0].constructor.name.should.eql('StorageReference');
      });

      it('should not crash if the user is not allowed to list the directory', async function () {
        const { getStorage, ref, listAll } = storageModular;
        const storageReference = ref(getStorage(), '/forbidden');

        try {
          await listAll(storageReference);
          return Promise.reject(new Error('listAll on a forbidden directory succeeded'));
        } catch (error) {
          error.code.should.equal('storage/unauthorized');
          if (!Platform.other) {
            error.message.should.equal(
              '[storage/unauthorized] User is not authorized to perform the desired action.',
            );
          }
          return Promise.resolve();
        }
      });
    });

    describe('updateMetadata', function () {
      it('should return the updated metadata for a file', async function () {
        const { getApp } = modular;
        const { getStorage, ref, updateMetadata } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/list/file1.txt`);

        let metadata = await updateMetadata(storageReference, {
          cacheControl: 'cache-control',
          contentDisposition: 'content-disposition',
          contentEncoding: 'application/octet-stream',
          contentLanguage: 'de',
          contentType: 'content-type-a',
          customMetadata: {
            a: 'b',
            y: 'z',
          },
        });

        // Things that are set automagically for us
        metadata.generation.should.be.a.String();
        metadata.fullPath.should.equal(`${PATH}/list/file1.txt`);
        if (Platform.android || Platform.other) {
          metadata.name.should.equal('file1.txt');
        } else {
          // FIXME on ios file comes through as fully-qualified
          // https://github.com/firebase/firebase-ios-sdk/issues/9849#issuecomment-1159819958
          metadata.name.should.equal(`${PATH}/list/file1.txt`);
        }
        metadata.size.should.be.a.Number();
        should.equal(metadata.size > 0, true);
        metadata.updated.should.be.a.String();
        metadata.timeCreated.should.be.a.String();
        metadata.metageneration.should.be.a.String();
        metadata.md5Hash.should.be.a.String();
        metadata.bucket.should.equal(`${getApp().options.projectId}.appspot.com`);

        // Things we just updated
        metadata.cacheControl.should.equals('cache-control');
        metadata.contentDisposition.should.equal('content-disposition');
        metadata.contentEncoding.should.equal('application/octet-stream');
        metadata.contentLanguage.should.equal('de');
        metadata.contentType.should.equal('content-type-a');
        metadata.customMetadata.should.be.an.Object();
        metadata.customMetadata.a.should.equal('b');
        metadata.customMetadata.y.should.equal('z');
        Object.keys(metadata.customMetadata).length.should.equal(2);

        // Now let's make sure removing metadata works
        metadata = await updateMetadata(storageReference, {
          contentType: null,
          cacheControl: null,
          contentDisposition: null,
          contentEncoding: null,
          contentLanguage: null,
          customMetadata: null,
        });

        // Things that are set automagically for us and are not updatable
        metadata.generation.should.be.a.String();
        metadata.fullPath.should.equal(`${PATH}/list/file1.txt`);
        if (Platform.android || Platform.other) {
          metadata.name.should.equal('file1.txt');
        } else {
          // FIXME on ios file comes through as fully-qualified
          // https://github.com/firebase/firebase-ios-sdk/issues/9849#issuecomment-1159819958
          metadata.name.should.equal(`${PATH}/list/file1.txt`);
        }
        metadata.size.should.be.a.Number();
        should.equal(metadata.size > 0, true);
        metadata.updated.should.be.a.String();
        metadata.timeCreated.should.be.a.String();
        metadata.metageneration.should.be.a.String();
        metadata.md5Hash.should.be.a.String();
        metadata.bucket.should.equal(`${getApp().options.projectId}.appspot.com`);

        // Things that we may set (or remove)
        should.equal(metadata.cacheControl, undefined);
        should.equal(metadata.contentDisposition, undefined);
        should.equal(metadata.contentEncoding, 'identity');
        should.equal(metadata.contentLanguage, undefined);
        should.equal(metadata.contentType, undefined);
        should.equal(metadata.customMetadata, undefined);
      });

      it('should set update or remove customMetadata properties correctly', async function () {
        const { getStorage, ref, updateMetadata } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/list/file1.txt`);

        let metadata = await updateMetadata(storageReference, {
          contentType: 'application/octet-stream',
          customMetadata: {
            keepMe: 'please',
            removeMeFirstTime: 'please',
            removeMeSecondTime: 'please',
          },
        });

        Object.keys(metadata.customMetadata).length.should.equal(3);
        metadata.customMetadata.keepMe.should.equal('please');
        metadata.customMetadata.removeMeFirstTime.should.equal('please');
        metadata.customMetadata.removeMeSecondTime.should.equal('please');

        metadata = await updateMetadata(storageReference, {
          contentType: 'application/octet-stream',
          customMetadata: {
            keepMe: 'please',
            removeMeFirstTime: null,
            removeMeSecondTime: 'please',
          },
        });

        Object.keys(metadata.customMetadata).length.should.equal(2);
        metadata.customMetadata.keepMe.should.equal('please');
        metadata.customMetadata.removeMeSecondTime.should.equal('please');

        metadata = await updateMetadata(storageReference, {
          contentType: 'application/octet-stream',
          customMetadata: {
            keepMe: 'please',
            removeMeSecondTime: null,
          },
        });

        Object.keys(metadata.customMetadata).length.should.equal(1);
        metadata.customMetadata.keepMe.should.equal('please');
      });

      it('should error if updateMetadata includes md5hash', async function () {
        const { getStorage, ref, updateMetadata } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/list/file1.txt`);

        try {
          await updateMetadata(storageReference, {
            md5hash: '0xDEADBEEF',
          });
          return Promise.reject(new Error('Did not throw on invalid updateMetadata'));
        } catch (e) {
          e.message.should.containEql('md5hash may only be set on upload, not on updateMetadata');
          return Promise.resolve();
        }
      });
    });

    describe('putFile', function () {
      it('errors if file path is not a string', async function () {
        const { getStorage, ref, putFile } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);

        try {
          putFile(storageReference, 1337);
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('expects a string value');
          return Promise.resolve();
        }
      });

      it('errors if metadata is not an object', async function () {
        const { getStorage, ref, putFile } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          putFile(storageReference, 'foo', 123);
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('must be an object value');
          return Promise.resolve();
        }
      });

      it('errors if metadata contains an unsupported property', async function () {
        const { getStorage, ref, putFile } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          putFile(storageReference, 'foo', { foo: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql("unknown property 'foo'");
          return Promise.resolve();
        }
      });

      it('errors if metadata property value is not a string or null value', async function () {
        const { getStorage, ref, putFile } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          putFile(storageReference, 'foo', { contentType: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('should be a string or null value');
          return Promise.resolve();
        }
      });

      it('errors if metadata.customMetadata is not an object', async function () {
        const { getStorage, ref, putFile } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          putFile(storageReference, 'foo', { customMetadata: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql(
            'customMetadata must be an object of keys and string values',
          );
          return Promise.resolve();
        }
      });

      // TODO check an metaData:md5hash property passes through correcty on putFile
    });

    describe('putString', function () {
      it('errors if metadata is not an object', async function () {
        const { getStorage, ref, uploadString } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          uploadString(storageReference, 'foo', 'raw', 123);
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('must be an object value');
          return Promise.resolve();
        }
      });

      it('errors if metadata contains an unsupported property', async function () {
        const { getStorage, ref, uploadString } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          uploadString(storageReference, 'foo', 'raw', { foo: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql("unknown property 'foo'");
          return Promise.resolve();
        }
      });

      it('errors if metadata property value is not a string or null value', async function () {
        const { getStorage, ref, uploadString } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          uploadString(storageReference, 'foo', 'raw', { contentType: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('should be a string or null value');
          return Promise.resolve();
        }
      });

      it('errors if metadata.customMetadata is not an object', async function () {
        const { getStorage, ref, uploadString } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          uploadString(storageReference, 'foo', 'raw', { customMetadata: true });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql(
            'customMetadata must be an object of keys and string values',
          );
          return Promise.resolve();
        }
      });

      it('allows valid metadata properties for upload', async function () {
        const { getStorage, ref, uploadString } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/metadataTest.txt`);

        await uploadString(storageReference, 'foo', 'raw', {
          contentType: 'text/plain',
          md5hash: '123412341234',
          cacheControl: 'true',
          contentDisposition: 'disposed',
          contentEncoding: 'application/octet-stream',
          contentLanguage: 'de',
          customMetadata: {
            customMetadata1: 'metadata1value',
          },
        });
      });
    });

    describe('put', function () {
      it('errors if metadata is not an object', async function () {
        const { getStorage, ref, uploadBytesResumable } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);

        try {
          uploadBytesResumable(storageReference, new ArrayBuffer(), 123);
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('must be an object value');
          return Promise.resolve();
        }
      });

      it('errors if metadata contains an unsupported property', async function () {
        const { getStorage, ref, uploadBytesResumable } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          uploadBytesResumable(storageReference, new ArrayBuffer(), {
            foo: true,
          });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql("unknown property 'foo'");
          return Promise.resolve();
        }
      });

      it('errors if metadata property value is not a string or null value', async function () {
        const { getStorage, ref, uploadBytesResumable } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          uploadBytesResumable(storageReference, new ArrayBuffer(), {
            contentType: true,
          });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql('should be a string or null value');
          return Promise.resolve();
        }
      });

      it('errors if metadata.customMetadata is not an object', async function () {
        const { getStorage, ref, uploadBytesResumable } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/ok.jpeg`);
        try {
          uploadBytesResumable(storageReference, new ArrayBuffer(), {
            customMetadata: true,
          });
          return Promise.reject(new Error('Did not error!'));
        } catch (error) {
          error.message.should.containEql(
            'customMetadata must be an object of keys and string values',
          );
          return Promise.resolve();
        }
      });

      it('allows valid metadata properties for upload', async function () {
        const { getStorage, ref, uploadBytesResumable } = storageModular;
        const storageReference = ref(getStorage(), `${PATH}/metadataTest.jpeg`);

        await uploadBytesResumable(storageReference, new ArrayBuffer(), {
          contentType: 'image/jpg',
          md5hash: '123412341234',
          cacheControl: 'true',
          contentDisposition: 'disposed',
          contentEncoding: 'application/octet-stream',
          contentLanguage: 'de',
          customMetadata: {
            customMetadata1: 'metadata1value',
          },
        });
      });
    });

    describe('put secondaryApp', function () {
      it('allows valid metadata properties for upload', async function () {
        const { getStorage, ref, uploadBytesResumable } = storageModular;
        const { getApp } = modular;
        const storageReference = ref(
          getStorage(getApp('secondaryFromNative')),
          `${PATH}/metadataTest.jpeg`,
        );

        await uploadBytesResumable(storageReference, new ArrayBuffer(), {
          contentType: 'image/jpg',
          md5hash: '123412341234',
          cacheControl: 'true',
          contentDisposition: 'disposed',
          contentEncoding: 'application/octet-stream',
          contentLanguage: 'de',
          customMetadata: {
            customMetadata1: 'metadata1value',
          },
        });
      });
    });
  });
});
