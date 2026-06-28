import { getStorage, setStorage, removeStorage } from '../storage'

export type Backend = {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
}

const localBackend: Backend = {
  get: getStorage,
  set: setStorage,
  remove: removeStorage,
}

export async function getBackend(): Promise<Backend> {
  return localBackend
}
