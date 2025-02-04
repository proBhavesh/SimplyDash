const mockAuth = {
  currentUser: { uid: 'testUid' },
  onAuthStateChanged: jest.fn(),
};

const mockFirestore = {
  collection: jest.fn(),
};

const mockApp = {
  auth: () => mockAuth,
  firestore: () => mockFirestore,
};

export const getAuth = jest.fn(() => mockAuth);
export const getFirestore = jest.fn(() => mockFirestore);
export const initializeApp = jest.fn(() => mockApp);
export const getApp = jest.fn(() => mockApp);
export const getApps = jest.fn(() => []);

export const auth = mockAuth;
export const db = mockFirestore;
export const app = mockApp;