// Run karo:  node js-practice/01-basics.js

// ---- Arrays ----
const numbers = [5, 12, 8, 130, 44]

const doubled = numbers.map((n) => n * 2)
const big = numbers.filter((n) => n > 10)
const total = numbers.reduce((sum, n) => sum + n, 0)

console.log({ doubled, big, total })

// ---- Objects & destructuring ----
const user = { name: 'Ali', age: 22, city: 'Lahore' }
const { name, ...rest } = user
console.log(name, rest)

// ---- Async / await ----
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  console.log('Wait shuru...')
  await wait(500)
  console.log('500ms baad!')
}
main()

// ================= EXERCISES =================
// 1. Ek function likho jo array ka sab se bara number return kare (Math.max ke baghair)
// 2. Ek function likho jo string ko reverse kare: "hello" -> "olleh"
// 3. Ek function likho jo check kare ke word palindrome hai ya nahi
// 4. Array of objects ko age ke hisaab se sort karo
