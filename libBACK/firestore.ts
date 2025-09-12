import { db } from "./firebase";
import { doc, setDoc, collection } from "firebase/firestore";

/**
 * Salva dados básicos do usuário em chatfit/{email}.
 * @param email Email do usuário (usado como ID do documento)
 * @param userData Objeto com os dados do usuário (nome, telefone, etc)
 */
export async function saveUserData(email: string, userData: any) {
  try {
    if (typeof userData !== "object" || Array.isArray(userData) || userData === null) {
      throw new Error("userData precisa ser um objeto!");
    }
    const userRef = doc(db, "chatfit", email);
    await setDoc(userRef, userData, { merge: true });
    console.log("Usuário salvo em Firestore:", { userRef, userData });
  } catch (error) {
    console.error("Erro ao salvar usuário no Firestore:", error);
    throw error;
  }
}

/**
 * Salva meta do usuário em chatfit/{email}/metasusuario/{autoId}
 * @param email Email do usuário (usado como ID do documento principal)
 * @param metaData Objeto com os dados da meta (nome, telefone, metas, cálculo completo)
 */
export async function saveUserMeta(email: string, metaData: any) {
  try {
    if (typeof metaData !== "object" || Array.isArray(metaData) || metaData === null) {
      throw new Error("metaData precisa ser um objeto!");
    }
    const metaRef = doc(collection(db, "chatfit", email, "metasusuario"));
    await setDoc(metaRef, {
      ...metaData,
      createdAt: new Date().toISOString(),
    });
    console.log("Meta salva em Firestore:", { metaRef, metaData });
  } catch (error) {
    console.error("Erro ao salvar meta no Firestore:", error);
    throw error;
  }
}