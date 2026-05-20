import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, getDocs, getDoc,
  updateDoc, deleteDoc, query, where, arrayUnion,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

export async function createCampaign(userId, displayName) {
  const ref = await addDoc(collection(db, 'campaigns'), {
    ownerId: userId,
    name: 'New Campaign',
    dmName: displayName || '',
    setting: '',
    description: '',
    members: [userId],
    sessions: [],
    npcs: [],
    locations: [],
    quests: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function getCampaigns(userId) {
  const q    = query(collection(db, 'campaigns'), where('members', 'array-contains', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getCampaign(campaignId) {
  const snap = await getDoc(doc(db, 'campaigns', campaignId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function saveCampaign(campaignId, data) {
  await updateDoc(doc(db, 'campaigns', campaignId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteCampaign(campaignId) {
  await deleteDoc(doc(db, 'campaigns', campaignId));
}

// ── Invite system ────────────────────────────────────────────
export async function sendInvite(campaignId, campaignName, invitedEmail, senderName) {
  const existing = await getDocs(
    query(collection(db, 'invites'),
      where('campaignId', '==', campaignId),
      where('invitedEmail', '==', invitedEmail.toLowerCase()),
      where('status', '==', 'pending')
    )
  );
  if (!existing.empty) throw new Error('Invite already sent to that email.');

  await addDoc(collection(db, 'invites'), {
    campaignId,
    campaignName,
    invitedEmail: invitedEmail.toLowerCase(),
    senderName,
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

export async function getPendingInvites(userEmail) {
  const q    = query(collection(db, 'invites'),
    where('invitedEmail', '==', userEmail.toLowerCase()),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function acceptInvite(inviteId, userId) {
  const inviteRef = doc(db, 'invites', inviteId);
  const invite    = (await getDoc(inviteRef)).data();
  if (!invite) throw new Error('Invite not found.');
  await updateDoc(doc(db, 'campaigns', invite.campaignId), {
    members: arrayUnion(userId)
  });
  await updateDoc(inviteRef, { status: 'accepted' });
  return invite.campaignId;
}

export async function declineInvite(inviteId) {
  await updateDoc(doc(db, 'invites', inviteId), { status: 'declined' });
}
