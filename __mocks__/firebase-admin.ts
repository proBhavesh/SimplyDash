const admin = {
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-user-id', email: 'test@example.com' }),
  }),
  firestore: () => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn().mockResolvedValue(null),
    get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    where: jest.fn().mockReturnThis(),
  }),
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
};

export default admin;