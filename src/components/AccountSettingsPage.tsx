// src/components/AccountSettingsPage.tsx

import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import {
  doc,
  getFirestore,
  getDoc,
  updateDoc,
  collection,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from '../app/firebaseConfig';
import { Header } from './Header';
import { useRouter } from 'next/router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'react-hot-toast';

export const AccountSettingsPage: React.FC = () => {
  const [workspaceName, setWorkspaceName] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // State for adding new user
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');

  useEffect(() => {
    const fetchWorkspaceName = async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        router.push('/login');
        return;
      }

      const db = getFirestore(app);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        let workspaceId = data.workspaceId;

        if (!workspaceId) {
          // Create a new workspace
          const workspaceRef = doc(collection(db, 'workspaces'));
          workspaceId = workspaceRef.id;

          await setDoc(workspaceRef, {
            name: 'My Workspace',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Update user document with new workspaceId
          await updateDoc(userDocRef, { workspaceId });
        }

        const workspaceDocRef = doc(db, 'workspaces', workspaceId);
        const workspaceDoc = await getDoc(workspaceDocRef);

        if (workspaceDoc.exists()) {
          const workspaceData = workspaceDoc.data();
          setWorkspaceName(workspaceData.name || 'My Workspace');
          setNewWorkspaceName(workspaceData.name || 'My Workspace');
        } else {
          console.error('Workspace not found');
          toast.error('Workspace not found');
        }
      } else {
        console.error('User document not found');
        toast.error('User document not found');
      }

      setLoading(false);
    };

    fetchWorkspaceName();
  }, [router]);

  const handleWorkspaceNameChange = async () => {
    setLoading(true);
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      const db = getFirestore(app);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        const workspaceId = data.workspaceId;
        const workspaceDocRef = doc(db, 'workspaces', workspaceId);

        await updateDoc(workspaceDocRef, {
          name: newWorkspaceName,
          updatedAt: serverTimestamp(),
        });

        setWorkspaceName(newWorkspaceName);
        toast.success('Workspace name updated successfully');
      } else {
        console.error('User document not found');
        toast.error('Failed to update workspace name');
      }
    }

    setLoading(false);
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error('Email and password are required');
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        router.push('/login');
        return;
      }

      const token = await user.getIdToken();

      const response = await fetch('/api/add-user-to-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('User added successfully');
        // Clear the form fields
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserName('');
      } else {
        console.error('Error adding user:', result.error);
        toast.error(`Error adding user: ${result.error}`);
      }
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Failed to add user');
    }

    setLoading(false);
  };

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto p-4">
        <h2 className="text-2xl font-bold mb-4">Account Settings</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {/* Workspace Name Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-2">Workspace Name</h3>
              <p className="mb-2">Current workspace name: {workspaceName}</p>
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                />
                <Button onClick={handleWorkspaceNameChange}>
                  Update Workspace Name
                </Button>
              </div>
            </div>

            {/* Add User to Workspace Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-2">
                Add User to Workspace
              </h3>
              <div className="space-y-4">
                <div className="flex flex-col">
                  <label>Email</label>
                  <Input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <label>Password</label>
                  <Input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <label>Name (optional)</label>
                  <Input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddUser}>Add User</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};
