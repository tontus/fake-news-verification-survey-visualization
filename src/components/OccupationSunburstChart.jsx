import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { Box, Typography, CircularProgress } from '@mui/material'

function OccupationSunburstChart({ csvData, width = 700, height = 400, isMobile = false }) {
    const svgRef = useRef()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    // Helper function to convert occupation to camelCase
    const toCamelCase = useCallback((str) => {
        return str
            .toLowerCase()
            .split(/[\s_-]+/)
            .map((word, index) => {
                if (index === 0) return word
                return word.charAt(0).toUpperCase() + word.slice(1)
            })
            .join('')
    }, [])

    const processData = useCallback((rawData) => {
        // Debug: Check what columns are available
        console.log('Raw data sample:', rawData[0])
        console.log('Available columns:', Object.keys(rawData[0] || {}))

        // Filter out empty rows and count occupation distribution by gender
        const cleanData = rawData.filter(row =>
            row.current_occupation && row.current_occupation.trim() !== '' &&
            row.gender && row.gender.trim() !== ''
        )

        console.log('Clean data count:', cleanData.length)

        const occupationGenderCounts = {}
        cleanData.forEach(row => {
            const occupation = toCamelCase(row.current_occupation.trim())
            const gender = row.gender === 'male' ? 'Male' : row.gender === 'female' ? 'Female' : row.gender

            if (!occupationGenderCounts[occupation]) {
                occupationGenderCounts[occupation] = { Male: 0, Female: 0, total: 0 }
            }

            occupationGenderCounts[occupation][gender] = (occupationGenderCounts[occupation][gender] || 0) + 1
            occupationGenderCounts[occupation].total += 1
        })

        console.log('Occupation gender counts:', occupationGenderCounts)

        // Create hierarchical data structure for sunburst
        const total = cleanData.length
        const hierarchyData = {
            name: "Survey Respondents",
            children: []
        }

        // Create gender groups
        const genderGroups = { Male: [], Female: [] }

        Object.keys(occupationGenderCounts).forEach(occupation => {
            const data = occupationGenderCounts[occupation]

            if (data.Male > 0) {
                genderGroups.Male.push({
                    name: occupation,
                    value: data.Male,
                    percentage: ((data.Male / total) * 100).toFixed(1)
                })
            }

            if (data.Female > 0) {
                genderGroups.Female.push({
                    name: occupation,
                    value: data.Female,
                    percentage: ((data.Female / total) * 100).toFixed(1)
                })
            }
        })        // Add gender groups to hierarchy
        Object.keys(genderGroups).forEach(gender => {
            if (genderGroups[gender].length > 0) {
                const totalForGender = genderGroups[gender].reduce((sum, item) => sum + item.value, 0)
                hierarchyData.children.push({
                    name: gender,
                    value: totalForGender,
                    percentage: ((totalForGender / total) * 100).toFixed(1),
                    children: genderGroups[gender].sort((a, b) => b.value - a.value) // Sort by value descending
                })
            }
        })

        console.log('Final hierarchy data:', hierarchyData)
        setData({ hierarchyData, total })
    }, [toCamelCase])

    useEffect(() => {
        if (csvData) {
            console.log('Processing CSV data in OccupationSunburstChart:', csvData)
            processData(csvData)
            setLoading(false)
        }
    }, [csvData, processData])

    useEffect(() => {
        if (!data) return

        const createSunburstChart = () => {
            const svg = d3.select(svgRef.current)
            svg.selectAll("*").remove() // Clear previous content

            const radius = Math.min(width, height) / 2 - 10
            const centerX = width / 2
            const centerY = height / 2

            svg.attr("width", width)
                .attr("height", height)

            const g = svg.append("g")
                .attr("transform", `translate(${centerX}, ${centerY})`)

            // Create color scale
            const colorScale = d3.scaleOrdinal()
                .domain(['Male', 'Female'])
                .range(['#1d2932ff', '#e74c3c'])

            // Create occupation color scale (variations of gender colors)
            const occupationColorScale = (gender, index, total) => {
                const baseColor = gender === 'Male' ? '#1d2932ff' : '#e74c3c'
                const opacity = 0.6 + (0.4 * (index / Math.max(total - 1, 1))) // Vary opacity from 0.6 to 1.0
                return d3.color(baseColor).copy({ opacity })
            }

            // Create hierarchy and partition layout
            const root = d3.hierarchy(data.hierarchyData)
                .sum(d => d.value)
                .sort((a, b) => b.value - a.value)

            const partition = d3.partition()
                .size([2 * Math.PI, radius])

            partition(root)

            // Create arcs
            const arc = d3.arc()
                .startAngle(d => d.x0)
                .endAngle(d => d.x1)
                .innerRadius(d => d.y0)
                .outerRadius(d => d.y1)

            // Add arcs
            g.selectAll('path')
                .data(root.descendants().filter(d => d.depth > 0))
                .enter()
                .append('path')
                .attr('d', arc)
                .attr('fill', (d) => {
                    if (d.depth === 1) {
                        // Gender level
                        return colorScale(d.data.name)
                    } else {
                        // Occupation level
                        const gender = d.parent.data.name
                        const siblings = d.parent.children
                        const index = siblings.indexOf(d)
                        return occupationColorScale(gender, index, siblings.length)
                    }
                })
                .attr('stroke', '#fff')
                .attr('stroke-width', 1)
                .style('cursor', 'pointer')
                .on('mouseover', function (event, d) {
                    d3.select(this).attr('opacity', 0.8)
                    showTooltip(event, d)
                })
                .on('mouseout', function () {
                    d3.select(this).attr('opacity', 1)
                    d3.selectAll('.tooltip').remove()
                })

            // Add labels for larger segments
            g.selectAll('text')
                .data(root.descendants().filter(d => d.depth > 0 && (d.x1 - d.x0) > 0.1))
                .enter()
                .append('text')
                .attr('transform', d => {
                    const angle = (d.x0 + d.x1) / 2
                    const labelRadius = (d.y0 + d.y1) / 2
                    const x = Math.cos(angle - Math.PI / 2) * labelRadius
                    const y = Math.sin(angle - Math.PI / 2) * labelRadius
                    return `translate(${x}, ${y})`
                })
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .style('font-size', isMobile ? '10px' : '12px')
                .style('font-weight', '500')
                .style('fill', '#fff')
                .style('pointer-events', 'none')
                .text(d => {
                    // Only show labels for segments that are large enough
                    if (d.depth === 1) {
                        return d.data.name
                    } else if ((d.x1 - d.x0) > 0.2) {
                        return d.data.name.length > 12 ? d.data.name.slice(0, 12) + '...' : d.data.name
                    }
                    return ''
                })

            // Tooltip function
            function showTooltip(event, d) {
                const tooltip = d3.select("body").append("div")
                    .attr("class", "tooltip")
                    .style("position", "absolute")
                    .style("background", "rgba(0, 0, 0, 0.8)")
                    .style("color", "white")
                    .style("padding", "10px")
                    .style("border-radius", "5px")
                    .style("pointer-events", "none")
                    .style("opacity", 0)

                let tooltipText = ''
                if (d.depth === 1) {
                    // Gender level
                    tooltipText = `${d.data.name}: ${d.value} respondents (${d.data.percentage}%)`
                } else {
                    // Occupation level
                    const gender = d.parent.data.name
                    tooltipText = `${d.data.name} (${gender}): ${d.value} respondents (${d.data.percentage}% of total)`
                }

                tooltip.transition()
                    .duration(200)
                    .style("opacity", 1)
                    .text(tooltipText)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px")
            }

            // Add center label
            g.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '-0.5em')
                .style('font-size', isMobile ? '14px' : '16px')
                .style('font-weight', 'bold')
                .style('fill', '#333')
                .text('Total')

            g.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '1em')
                .style('font-size', isMobile ? '12px' : '14px')
                .style('fill', '#666')
                .text(`${data.total} Respondents`)

            // Add title
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", 30)
                .attr("text-anchor", "middle")
                .style("font-size", isMobile ? "16px" : "18px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text("Occupation Distribution by Gender")

            // Add subtitle
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", 50)
                .attr("text-anchor", "middle")
                .style("font-size", isMobile ? "12px" : "14px")
                .style("fill", "#666")
                .text("Sunburst chart showing occupation breakdown within each gender")
        }

        createSunburstChart()
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
                    Loading occupation data...
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

export default OccupationSunburstChart
