import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import MaleIcon from '@mui/icons-material/Man'
import FemaleIcon from '@mui/icons-material/Woman'
import { createRoot } from 'react-dom/client'
import { Box, Typography, CircularProgress, Card, CardContent } from '@mui/material'

function EducationChart({ csvData }) {
    const svgRef = useRef()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (csvData) {
            console.log('Processing CSV data in EducationChart:', csvData)
            processData(csvData)
            setLoading(false)
        }
    }, [csvData])

    const processData = (rawData) => {
        // Debug: Check what columns are available
        console.log('Raw data sample:', rawData[0])
        console.log('Available columns:', Object.keys(rawData[0] || {}))

        // Filter out empty rows and count education distribution by gender
        const cleanData = rawData.filter(row =>
            row.education_qualifications && row.education_qualifications.trim() !== '' &&
            row.gender && row.gender.trim() !== ''
        )

        console.log('Clean data count:', cleanData.length)

        const educationGenderCounts = {}
        cleanData.forEach(row => {
            const education = row.education_qualifications.trim()
            const gender = row.gender === 'male' ? 'Male' : row.gender === 'female' ? 'Female' : row.gender

            if (!educationGenderCounts[education]) {
                educationGenderCounts[education] = { Male: 0, Female: 0, total: 0 }
            }

            educationGenderCounts[education][gender] = (educationGenderCounts[education][gender] || 0) + 1
            educationGenderCounts[education].total += 1
        })

        console.log('Education gender counts:', educationGenderCounts)

        const total = cleanData.length
        const educationData = Object.keys(educationGenderCounts)
            .map(education => {
                const data = educationGenderCounts[education]
                return {
                    education,
                    total: data.total,
                    maleCount: data.Male || 0,
                    femaleCount: data.Female || 0,
                    malePercentage: ((data.Male || 0) / data.total * 100).toFixed(1),
                    femalePercentage: ((data.Female || 0) / data.total * 100).toFixed(1),
                    totalPercentage: (data.total / total * 100).toFixed(1)
                }
            })
            .sort((a, b) => b.total - a.total) // Sort by total count descending

        console.log('Final education data:', educationData)
        setData({ educationData, total })
    }

    useEffect(() => {
        if (!data) return

        const createBarChart = () => {
            const svg = d3.select(svgRef.current)
            svg.selectAll("*").remove() // Clear previous content

            const margin = { top: 80, right: 100, bottom: 60, left: 200 }
            const width = 700 - margin.left - margin.right
            const height = 400 - margin.top - margin.bottom

            svg.attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)

            const g = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`)

            // Create scales
            const xScale = d3.scaleLinear()
                .domain([0, d3.max(data.educationData, d => d.total)])
                .range([0, width])

            const yScale = d3.scaleBand()
                .domain(data.educationData.map(d => d.education))
                .range([0, height])
                .padding(0.5)

            // Gender colors
            const genderColors = {
                Male: '#1d2932ff',
                Female: '#e74c3c'
            }

            // Create stacked bars for each education level
            data.educationData.forEach(d => {
                const barY = yScale(d.education)
                const barHeight = yScale.bandwidth()
                const totalWidth = xScale(d.total)

                // Create background rounded rectangle for the entire bar
                g.append("rect")
                    .attr("class", "background-bar")
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", totalWidth)
                    .attr("height", barHeight)
                    .attr("rx", 4)
                    .attr("ry", 4)
                    .attr("fill", "#f0f0f0")
                    .attr("opacity", 0.3)

                // Male bar (left side)
                const maleWidth = xScale(d.maleCount)
                if (d.maleCount > 0) {
                    g.append("rect")
                        .attr("class", "male-bar")
                        .attr("x", 0)
                        .attr("y", barY)
                        .attr("width", maleWidth)
                        .attr("height", barHeight)
                        .attr("fill", genderColors.Male)
                        .attr("opacity", 1)
                        .on("mouseover", function (event) {
                            d3.select(this).attr("opacity", 0.8)
                            showTooltip(event, `Males in ${d.education}: ${d.maleCount} (${d.malePercentage}% of this education level)\nTotal for ${d.education}: ${d.total}`)
                        })
                        .on("mouseout", function () {
                            d3.select(this).attr("opacity", 1)
                            d3.selectAll(".tooltip").remove()
                        })
                }

                // Female bar (right side, stacked)
                const femaleWidth = xScale(d.femaleCount)
                if (d.femaleCount > 0) {
                    g.append("rect")
                        .attr("class", "female-bar")
                        .attr("x", maleWidth)
                        .attr("y", barY)
                        .attr("width", femaleWidth)
                        .attr("height", barHeight)
                        .attr("fill", genderColors.Female)
                        .attr("opacity", 1)
                        .on("mouseover", function (event) {
                            d3.select(this).attr("opacity", 0.8)
                            showTooltip(event, `Females in ${d.education}: ${d.femaleCount} (${d.femalePercentage}% of this education level)\nTotal for ${d.education}: ${d.total}`)
                        })
                        .on("mouseout", function () {
                            d3.select(this).attr("opacity", 1)
                            d3.selectAll(".tooltip").remove()
                        })
                }

                // Create a clipping path for the rounded corners
                const clipId = `clip-${d.education.replace(/\s+/g, '-')}`
                g.append("defs")
                    .append("clipPath")
                    .attr("id", clipId)
                    .append("rect")
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", totalWidth)
                    .attr("height", barHeight)
                    .attr("rx", 4)
                    .attr("ry", 4)

                // Apply clipping to both bars
                g.selectAll(`.male-bar, .female-bar`)
                    .filter((_, i, nodes) => {
                        // Only apply to the bars we just created for this education level
                        const node = d3.select(nodes[i])
                        const nodeY = +node.attr('y')
                        return Math.abs(nodeY - barY) < 1
                    })
                    .attr("clip-path", `url(#${clipId})`)

                // Add gender icons
                if (d.maleCount > 0) {
                    const maleIconX = maleWidth / 2 - 10
                    const iconY = barY + barHeight / 2 - 10

                    const maleForeignObject = g.append("foreignObject")
                        .attr("x", maleIconX)
                        .attr("y", iconY)
                        .attr("width", 20)
                        .attr("height", 20)
                        .style("pointer-events", "none")

                    const maleContainer = document.createElement('div')
                    maleContainer.style.display = 'flex'
                    maleContainer.style.justifyContent = 'center'
                    maleContainer.style.alignItems = 'center'
                    maleContainer.style.width = '100%'
                    maleContainer.style.height = '100%'

                    const maleRoot = createRoot(maleContainer)
                    maleRoot.render(<MaleIcon style={{ color: '#fff', fontSize: '18px' }} />)
                    maleForeignObject.node().appendChild(maleContainer)
                }

                if (d.femaleCount > 0) {
                    const femaleIconX = maleWidth + femaleWidth / 2 - 10
                    const iconY = barY + barHeight / 2 - 10

                    const femaleForeignObject = g.append("foreignObject")
                        .attr("x", femaleIconX)
                        .attr("y", iconY)
                        .attr("width", 20)
                        .attr("height", 20)
                        .style("pointer-events", "none")

                    const femaleContainer = document.createElement('div')
                    femaleContainer.style.display = 'flex'
                    femaleContainer.style.justifyContent = 'center'
                    femaleContainer.style.alignItems = 'center'
                    femaleContainer.style.width = '100%'
                    femaleContainer.style.height = '100%'

                    const femaleRoot = createRoot(femaleContainer)
                    femaleRoot.render(<FemaleIcon style={{ color: '#fff', fontSize: '18px' }} />)
                    femaleForeignObject.node().appendChild(femaleContainer)
                }
            })

            // Tooltip function
            function showTooltip(event, text) {
                const tooltip = d3.select("body").append("div")
                    .attr("class", "tooltip")
                    .style("position", "absolute")
                    .style("background", "rgba(0, 0, 0, 0.8)")
                    .style("color", "white")
                    .style("padding", "10px")
                    .style("border-radius", "5px")
                    .style("pointer-events", "none")
                    .style("opacity", 0)

                tooltip.transition()
                    .duration(200)
                    .style("opacity", 1)
                    .text(text)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px")
            }

            // Add Y axis (education labels)
            g.selectAll(".y-label")
                .data(data.educationData)
                .enter()
                .append("text")
                .attr("class", "y-label")
                .attr("x", -10)
                .attr("y", d => yScale(d.education) + yScale.bandwidth() / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-size", "12px")
                .style("fill", "#333")
                .style("font-weight", "500")
                .text(d => d.education)

            // Add X axis
            const xAxis = d3.axisBottom(xScale)
                .ticks(5)
                .tickFormat(d => d)

            g.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(0, ${height})`)
                .call(xAxis)
                .selectAll("text")
                .style("font-size", "11px")
                .style("fill", "#666")

            // Add X axis label
            g.append("text")
                .attr("x", width / 2)
                .attr("y", height + 40)
                .attr("text-anchor", "middle")
                .style("font-size", "12px")
                .style("fill", "#666")
                .text("Number of Respondents")

            // Add title
            svg.append("text")
                .attr("x", (width + margin.left + margin.right) / 2)
                .attr("y", 30)
                .attr("text-anchor", "middle")
                .style("font-size", "18px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text("Education Qualification by Gender Distribution")

            // Add subtitle
            svg.append("text")
                .attr("x", (width + margin.left + margin.right) / 2)
                .attr("y", 50)
                .attr("text-anchor", "middle")
                .style("font-size", "14px")
                .style("fill", "#666")
                .text("Stacked bars showing male/female distribution within each education level")

        }

        createBarChart()
    }, [data])

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
                    Loading education data...
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

export default EducationChart
