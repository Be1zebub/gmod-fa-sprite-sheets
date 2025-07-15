local sheetSize = Vector(2048, 2816)
local iconSize = Vector(64, 64)
local sheet = Material("fa-solid.png", "smooth")
local sheetPositions = include("fa-sheet.lua")

local testIcons = {
	"house",
	"download",
	"thumbs-up",
	"rocket",
	"font-awesome",

	"image",
	"web-awesome",
	"fire",
	"share",
	"folder",

	"font",
	"city",
	"ticket",
	"tree",
	"compass"
}

local function getUV(pos)
	pos = {
		x = (pos.x - 1) * iconSize.x,
		y = (pos.y - 1) * iconSize.y
	}

	return {
		pos.x / sheetSize.x,
		pos.y / sheetSize.y,
		(pos.x + iconSize.x) / sheetSize.x,
		(pos.y + iconSize.y) / sheetSize.y
	}
end

hook.Add("HUDPaint", "fa-rendering-example", function()
	local x, y = 24, 24

	for i, icon in ipairs(testIcons) do
		local uv = getUV(sheetPositions[icon])

		surface.SetDrawColor(HSVToColor((SysTime() * 60 + i * 10) % 360, 1, 1))
		surface.SetMaterial(sheet)
		surface.DrawTexturedRectUV(x, y, 24, 24, uv[1], uv[2], uv[3], uv[4])

		x = x + 32

		if i % 5 == 0 then
			x = 24
			y = y + 32
		end
	end
end)
