// pages/assistant/[assistantId].tsx

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { AssistantDetailPage } from '../../src/components/assistant-detail-page';
import OpenAIAssistantDetailPage from '../../src/components/OpenAIAssistantDetailPage';
import { app } from '../../src/app/firebaseConfig';
import { Assistant } from '../../src/types/assistant';
import { Footer } from '../../src/components/Footer'; // Import the Footer component

export default function AssistantDetail() {
  const router = useRouter();
  const { assistantId } = router.query;
  const [assistantType, setAssistantType] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssistantType = async () => {
      if (!assistantId || typeof assistantId !== 'string') {
        return;
      }

      const db = getFirestore(app);

      // Try fetching from 'assistants' collection (VAPI assistants)
      const vapiDocRef = doc(db, 'assistants', assistantId);
      const vapiDoc = await getDoc(vapiDocRef);
      if (vapiDoc.exists()) {
        setAssistantType('vapi');
        return;
      }

      // Try fetching from 'openaiAssistants' collection (OpenAI Realtime assistants)
      const openaiDocRef = doc(db, 'openaiAssistants', assistantId);
      const openaiDoc = await getDoc(openaiDocRef);
      if (openaiDoc.exists()) {
        setAssistantType('openai-realtime');
        return;
      }

      // If assistant is not found
      setAssistantType('not-found');
    };

    fetchAssistantType();
  }, [assistantId]);

  if (!assistantId || typeof assistantId !== 'string' || !assistantType) {
    return (
      <>
        <p>Loading...</p>
        <Footer />
      </>
    );
  }

  if (assistantType === 'vapi') {
    return (
      <>
        <AssistantDetailPage assistantId={assistantId} />
        <Footer />
      </>
    );
  } else if (assistantType === 'openai-realtime') {
    return (
      <>
        <OpenAIAssistantDetailPage assistantId={assistantId} />
        <Footer />
      </>
    );
  } else {
    return (
      <>
        <p>Assistant not found.</p>
        <Footer />
      </>
    );
  }
}
