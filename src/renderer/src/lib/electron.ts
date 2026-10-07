export const electron = window.electron

export const isElectron = typeof window !== 'undefined' && !!window.electron

export const getElectron = () => electron;