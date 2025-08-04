import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import MaleIcon from '@mui/icons-material/Man'
import FemaleIcon from '@mui/icons-material/Woman'
import PersonIcon from '@mui/icons-material/Person'
import { createRoot } from 'react-dom/client'
import { Box, Typography, CircularProgress, Paper, Card, CardContent } from '@mui/material'

function GenderPictorialChart({ csvData, width = 700, height = 400, isMobile = false }) {
    const svgRef = useRef()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (csvData) {
            console.log('Processing CSV data in GenderPictorialChart:', csvData)
            processData(csvData)
            setLoading(false)
        }
    }, [csvData, width, height, isMobile])

    const processData = (rawData) => {
        // Filter out empty rows and count gender distribution
        const cleanData = rawData.filter(row => row.gender)

        const genderCounts = {}
        cleanData.forEach(row => {
            const gender = row.gender === 'male' ? 'Male' : row.gender === 'female' ? 'Female' : row.gender
            genderCounts[gender] = (genderCounts[gender] || 0) + 1
        })

        const total = cleanData.length
        const genderData = Object.keys(genderCounts).map(gender => ({
            gender,
            count: genderCounts[gender],
            percentage: ((genderCounts[gender] / total) * 100).toFixed(1)
        }))

        setData({ genderData, total })
    }

    useEffect(() => {
        if (!data) return

        const createPictorialChart = () => {
            const svg = d3.select(svgRef.current)
            svg.selectAll("*").remove() // Clear previous content

            svg.attr("width", width).attr("height", height)

            // Responsive grid parameters
            const unitsPerRow = isMobile ? 15 : 20
            const totalUnits = 100
            const unitSize = isMobile ? 16 : 20
            const spacing = isMobile ? 3 : 5

            // Calculate grid dimensions
            const gridWidth = unitsPerRow * (unitSize + spacing) - spacing
            const gridHeight = (totalUnits / unitsPerRow) * (unitSize + spacing) - spacing

            // Center the grid
            const startX = (width - gridWidth) / 2
            const startY = (height - gridHeight) / 2

            // Create color scale
            const colorScale = d3.scaleOrdinal()
                .domain(data.genderData.map(d => d.gender))
                .range(['#1d2932ff', '#e74c3c', '#f39c12']) // Blue for male, red for female, orange for others

            // Calculate how many units each gender should have
            let unitIndex = 0
            const units = []

            data.genderData.forEach(genderItem => {
                const unitsForGender = Math.round((genderItem.count / data.total) * totalUnits)
                for (let i = 0; i < unitsForGender && unitIndex < totalUnits; i++) {
                    units.push({
                        gender: genderItem.gender,
                        index: unitIndex,
                        row: Math.floor(unitIndex / unitsPerRow),
                        col: unitIndex % unitsPerRow
                    })
                    unitIndex++
                }
            })

            // Create the pictorial units
            const g = svg.append("g")

            // Add person icons
            g.selectAll("g.person-icon")
                .data(units)
                .enter()
                .append("g")
                .attr("class", "person-icon")
                .attr("transform", d => `translate(${startX + d.col * (unitSize + spacing)}, ${startY + d.row * (unitSize + spacing)})`)
                .each(function (d) {
                    const iconGroup = d3.select(this)

                    // Add Material Icon based on gender using React components
                    const foreignObject = iconGroup.append("foreignObject")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", unitSize)
                        .attr("height", unitSize)

                    const iconContainer = document.createElement('div')
                    iconContainer.style.display = 'flex'
                    iconContainer.style.justifyContent = 'center'
                    iconContainer.style.alignItems = 'center'
                    iconContainer.style.width = '100%'
                    iconContainer.style.height = '100%'

                    // Create React root and render the appropriate Material Icon
                    const root = createRoot(iconContainer)

                    if (d.gender === 'Male') {
                        root.render(<MaleIcon style={{ color: colorScale(d.gender), fontSize: '24px' }} />)
                    } else if (d.gender === 'Female') {
                        root.render(<FemaleIcon style={{ color: colorScale(d.gender), fontSize: '24px' }} />)
                    } else {
                        root.render(<PersonIcon style={{ color: colorScale(d.gender), fontSize: '24px' }} />)
                    }

                    foreignObject.node().appendChild(iconContainer)
                })
                .on("mouseover", function (event, d) {
                    // Scale up the icon on hover
                    d3.select(this).select("foreignObject")
                        .transition()
                        .duration(200)
                        .attr("transform", "scale(1.2)")

                    // Show tooltip
                    const tooltip = d3.select("body").append("div")
                        .attr("class", "tooltip")
                        .style("position", "absolute")
                        .style("background", "rgba(0, 0, 0, 0.8)")
                        .style("color", "white")
                        .style("padding", "10px")
                        .style("border-radius", "5px")
                        .style("pointer-events", "none")
                        .style("opacity", 0)

                    const genderInfo = data.genderData.find(g => g.gender === d.gender)
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", 1)
                        .text(`${d.gender}: ${genderInfo.count} (${genderInfo.percentage}%)`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px")
                })
                .on("mouseout", function () {
                    // Scale back to normal
                    d3.select(this).select("foreignObject")
                        .transition()
                        .duration(200)
                        .attr("transform", "scale(1)")
                    d3.selectAll(".tooltip").remove()
                })

            // Add title
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", 30)
                .attr("text-anchor", "middle")
                .style("font-size", isMobile ? "16px" : "18px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text("Gender Distribution (Each icon = 1%)")

            // Add legend as part of title area
            const legendText = data.genderData.map(d => `${d.gender}: ${d.percentage}%`).join("  •  ")

            svg.append("text")
                .attr("x", width / 2)
                .attr("y", 50)
                .attr("text-anchor", "middle")
                .style("font-size", isMobile ? "12px" : "14px")
                .style("font-weight", "500")
                .style("fill", "#666")
                .text(legendText)

            // Add subtitle
            // svg.append("text")
            //     .attr("x", width / 2)
            //     .attr("y", height - 25)
            //     .attr("text-anchor", "middle")
            //     .style("font-size", "12px")
            //     .style("fill", "#666")
            //     .text(`Total Respondents: ${data.total}`)
        }

        createPictorialChart()
    }, [data, width, height, isMobile])

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '400px',
                    gap: 2
                }}
            >
                <CircularProgress size={60} />
                <Typography variant="h6" color="text.secondary">
                    Loading gender distribution data...
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ width: '100%' }}>

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <svg ref={svgRef}></svg>
            </Box>
        </Box>
    )
}

export default GenderPictorialChart
