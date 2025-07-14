const fs = require("fs").promises
const path = require("path")
const sharp = require("sharp")
const { glob } = require("glob")

const ICON_SIZE = 64 // размер каждой иконки
const ICONS_PER_ROW = 32 // количество иконок в ряду
const STYLES = {
	brands: true,
	regular: true,
	solid: true,
}

async function convertSvgToPng(svgPath) {
	const svg = await fs.readFile(svgPath, "utf8")
	// Добавляем fill="white" к SVG
	const whiteSvg = svg.replace(/<svg/, '<svg fill="white"')

	const png = await sharp(Buffer.from(whiteSvg))
		.resize(ICON_SIZE, ICON_SIZE, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.png()
		.toBuffer()
	return png
}

async function ensureDirectoryExists(dirPath) {
	try {
		await fs.access(dirPath)
	} catch {
		await fs.mkdir(dirPath, { recursive: true })
	}
}

function formatTime(ms) {
	if (ms < 1000) {
		return `${ms}ms`
	}
	return `${(ms / 1000).toFixed(1)}s`
}

function generateLuaTable(positions) {
	const parts = []
	for (const [key, value] of Object.entries(positions)) {
		parts.push(`["${key}"]={x=${value.x},y=${value.y}}`)
	}
	return `return{${parts.join(",")}}`
}

class ProgressTracker {
	constructor(total, message) {
		this.total = total
		this.current = 0
		this.message = message
		this.startTime = Date.now()
	}

	update(current) {
		this.current = current
		this.render()
	}

	increment() {
		this.update(this.current + 1)
	}

	render() {
		const percentage = Math.floor((this.current / this.total) * 100)
		const progressWidth = 20
		const filledWidth = Math.floor((progressWidth * this.current) / this.total)
		const emptyWidth = progressWidth - filledWidth
		const elapsed = formatTime(Date.now() - this.startTime)

		const progressBar =
			"[" + "=".repeat(filledWidth) + " ".repeat(emptyWidth) + "]"

		process.stdout.write(
			`\r\t${this.message} ${progressBar} ${this.current}/${this.total} (${percentage}%) ${elapsed}`
		)
	}

	finish() {
		this.update(this.total)
		console.log() // Новая строка после завершения
	}
}

async function withTimer(message, operation) {
	const startTime = Date.now()
	let timer = null

	// Функция обновления времени
	const updateTimer = () => {
		const elapsed = Date.now() - startTime
		process.stdout.write(`\r\t${message} (${formatTime(elapsed)})`)
	}

	try {
		// Запускаем таймер обновления каждые 100ms
		timer = setInterval(updateTimer, 100)

		// Выполняем операцию
		const result = await operation()

		// Показываем финальное время
		const totalTime = Date.now() - startTime
		process.stdout.write(
			`\r\t${message} completed in ${formatTime(totalTime)}\n`
		)

		return result
	} finally {
		if (timer) {
			clearInterval(timer)
		}
	}
}

async function generateSpritesheet(style) {
	const svgFiles = await glob(
		`node_modules/@fortawesome/fontawesome-free/svgs/${style}/*.svg`
	)
	const icons = []
	const positions = {}

	console.log(`\nProcessing ${style} icons:`)

	// Конвертируем все SVG в PNG
	console.log("\n1. Converting SVG to PNG...")
	const convertProgress = new ProgressTracker(svgFiles.length, "Progress")

	for (let i = 0; i < svgFiles.length; i++) {
		const svgFile = svgFiles[i]
		const iconName = path.basename(svgFile, ".svg")
		const png = await convertSvgToPng(svgFile)
		icons.push({
			name: iconName,
			buffer: png,
		})
		convertProgress.increment()
	}

	// Вычисляем размеры spritesheet
	const totalIcons = icons.length
	const rows = Math.ceil(totalIcons / ICONS_PER_ROW)
	const width = ICONS_PER_ROW * ICON_SIZE
	const height = rows * ICON_SIZE

	console.log("\n2. Creating spritesheet...")
	// Создаем пустой spritesheet
	const spritesheet = sharp({
		create: {
			width,
			height,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})

	// Создаем композицию из иконок
	const compositeOperations = []
	const luaPositions = {}

	const compositeProgress = new ProgressTracker(icons.length, "Compositing")

	for (let i = 0; i < icons.length; i++) {
		const icon = icons[i]
		const row = Math.floor(i / ICONS_PER_ROW)
		const col = i % ICONS_PER_ROW
		const x = col * ICON_SIZE
		const y = row * ICON_SIZE

		compositeOperations.push({
			input: icon.buffer,
			left: x,
			top: y,
		})

		// Сохраняем нормализованные позиции для Lua таблицы (начиная с 1)
		luaPositions[icon.name] = { x: col + 1, y: row + 1 }

		compositeProgress.increment()
	}

	const outputDir = path.join(process.cwd(), "dist", style)
	await ensureDirectoryExists(outputDir)

	console.log("\n3. Saving files...")

	// Сохраняем PNG с таймером
	const sheetBuffer = await withTimer("Generating PNG buffer", async () => {
		return await spritesheet.composite(compositeOperations).png().toBuffer()
	})

	await withTimer("Saving PNG file", async () => {
		await fs.writeFile(path.join(outputDir, "sheet.png"), sheetBuffer)
	})

	// Генерируем Lua файл
	await withTimer("Saving Lua file", async () => {
		await fs.writeFile(
			path.join(outputDir, "sheet.lua"),
			generateLuaTable(luaPositions)
		)
	})
}

async function main() {
	const styles = ["brands", "regular", "solid"]

	// Создаем dist директорию
	const distDir = path.join(process.cwd(), "dist")
	await ensureDirectoryExists(distDir)

	// Генерируем spritesheet для каждого стиля
	for (const style of styles) {
		if (!STYLES[style]) continue

		await generateSpritesheet(style)
	}

	console.log("\nAll done! 🎉")
}

main().catch(console.error)
