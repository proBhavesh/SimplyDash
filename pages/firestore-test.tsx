import React from 'react';
import FirestoreTest from '../src/components/FirestoreTest';

const FirestoreTestPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Firestore Test Page</h1>
      <FirestoreTest />
    </div>
  );
};

export default FirestoreTestPage;