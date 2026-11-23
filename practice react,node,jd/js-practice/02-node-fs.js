// Run karo:  node js-practice/02-node-fs.js
// Node ke built-in modules ki practice
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, 'notes.txt')

await fs.writeFile(file, 'Pehli line\n')
await fs.appendFile(file, 'Doosri line\n')
const content = await fs.readFile(file, 'utf8')
console.log(content)
await fs.unlink(file) // file delete

// ================= EXERCISES =================
// 1. Ek JSON file mein array of users save karo, phir parh ke print karo
// 2. Is folder ki sab files ki list print karo (fs.readdir)
// 3. Ek simple http server banao (node:http) jo "Hello" return kare
