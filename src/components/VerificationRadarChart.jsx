import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { Box, Typography, CircularProgress } from '@mui/material'

function VerificationRadarChart({ csvData, width = 700, height = 400, isMobile = false }) {
    const svgRef = useRef()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    const processData = useCallback((rawData) => {
        // Debug: Check what columns are available
        console.log('Raw data sample:', rawData[0])
        console.log('Available columns:', Object.keys(rawData[0] || {}))

        // Filter out empty rows and get clean data
        const cleanData = rawData.filter(row =>
            row.political_view && row.political_view.trim() !== '' &&
            row.verification_importance && row.verification_importance.trim() !== '' &&
            row.trustworthiness && row.trustworthiness.trim() !== '' &&
            row.verification_level && row.verification_level.trim() !== '' &&
            !isNaN(parseFloat(row.verification_importance)) &&
            !isNaN(parseFloat(row.trustworthiness)) &&
            !isNaN(parseFloat(row.verification_level))
        )

        console.log('Clean data count:', cleanData.length)

        // Group by political view and calculate averages
        const politicalViewGroups = {}
        cleanData.forEach(row => {
            const politicalView = row.political_view.trim()

            if (!politicalViewGroups[politicalView]) {
                politicalViewGroups[politicalView] = {
                    verification_importance: [],
                    trustworthiness: [],
                    verification_level: []
                }
            }

            politicalViewGroups[politicalView].verification_importance.push(parseFloat(row.verification_importance))
            politicalViewGroups[politicalView].trustworthiness.push(parseFloat(row.trustworthiness))
            politicalViewGroups[politicalView].verification_level.push(parseFloat(row.verification_level))
        })

        console.log('Political view groups:', politicalViewGroups)

        // Calculate averages for each political view
        const radarData = Object.keys(politicalViewGroups).map(politicalView => {
            const group = politicalViewGroups[politicalView]

            return {
                politicalView: politicalView,
                count: group.verification_importance.length,
                metrics: [
                    {
                        axis: 'Verification Importance',
                        value: group.verification_importance.reduce((sum, val) => sum + val, 0) / group.verification_importance.length
                    },
                    {
                        axis: 'Trustworthiness',
                        value: group.trustworthiness.reduce((sum, val) => sum + val, 0) / group.trustworthiness.length
                    },
                    {
                        axis: 'Verification Level',
                        value: group.verification_level.reduce((sum, val) => sum + val, 0) / group.verification_level.length
                    }
                ]
            }
        }).sort((a, b) => b.count - a.count) // Sort by sample size

        console.log('Final radar data:', radarData)
        setData({ radarData, total: cleanData.length })
    }, [])

    useEffect(() => {
        if (csvData) {
            console.log('Processing CSV data in VerificationRadarChart:', csvData)
            processData(csvData)
            setLoading(false)
        }
    }, [csvData, processData])

    useEffect(() => {
        if (!data) return

        const createRadarChart = () => {
            const svg = d3.select(svgRef.current)
            svg.selectAll("*").remove() // Clear previous content

            const margin = {
                top: 80,
                right: 120,
                bottom: 80,
                left: 120
            }
            const chartWidth = width - margin.left - margin.right
            const chartHeight = height - margin.top - margin.bottom
            const radius = Math.min(chartWidth, chartHeight) / 1.7

            svg.attr("width", width)
                .attr("height", height)

            const g = svg.append("g")
                .attr("transform", `translate(${width / 2}, ${height / 2 + 40})`) // Move radar down by 40px

            // Get all metrics from the first item (assuming all have same structure)
            const allAxis = data.radarData[0].metrics.map(d => d.axis)
            const total = allAxis.length
            const angleSlice = Math.PI * 2 / total

            // Find the maximum value across all metrics for scaling
            const maxValue = d3.max(data.radarData, d => d3.max(d.metrics, m => m.value))
            const minValue = 4 // Start from 3.6 as there are no values below this
            const rScale = d3.scaleLinear()
                .range([0, radius])
                .domain([minValue, maxValue])

            // Create color scale for different political views
            const colorScale = d3.scaleOrdinal()
                .domain(data.radarData.map(d => d.politicalView))
                .range(['#1d2932ff', '#e74c3c', '#f39c12', '#2ecc71', '#9b59b6', '#e67e22', '#34495e'])

            // Draw the circular grid
            const levels = 5
            for (let level = 1; level <= levels; level++) {
                const levelRadius = radius * (level / levels)

                // Draw grid circles
                g.append("circle")
                    .attr("r", levelRadius)
                    .style("fill", "none")
                    .style("stroke", "#CDCDCD")
                    .style("stroke-width", "1px")
                    .style("stroke-opacity", 0.5)

                // Add level labels
                g.append("text")
                    .attr("x", 4)
                    .attr("y", -levelRadius)
                    .attr("dy", "0.35em")
                    .style("font-size", isMobile ? "10px" : "12px")
                    .style("fill", "#737373")
                    .text((minValue + (maxValue - minValue) * level / levels).toFixed(1))
            }

            // Draw the axis lines
            allAxis.forEach((axis, i) => {
                const angle = angleSlice * i - Math.PI / 2

                g.append("line")
                    .attr("x1", 0)
                    .attr("y1", 0)
                    .attr("x2", radius * Math.cos(angle))
                    .attr("y2", radius * Math.sin(angle))
                    .style("stroke", "#CDCDCD")
                    .style("stroke-width", "2px")

                // Add axis labels
                const labelRadius = radius * 1.1
                g.append("text")
                    .attr("x", labelRadius * Math.cos(angle))
                    .attr("y", labelRadius * Math.sin(angle))
                    .attr("dy", "0.35em")
                    .style("font-size", isMobile ? "11px" : "13px")
                    .style("font-weight", "bold")
                    .style("fill", "#333")
                    .style("text-anchor", "middle")
                    .text(axis)
            })

            // Draw radar areas for each political view
            const areasGroup = g.append("g").attr("class", "radar-areas")
            const pointsGroup = g.append("g").attr("class", "radar-points")

            data.radarData.forEach((group) => {
                const radarLine = d3.lineRadial()
                    .angle((d, i) => angleSlice * i)
                    .radius(d => rScale(d.value))
                    .curve(d3.curveLinearClosed)

                const radarArea = d3.areaRadial()
                    .angle((d, i) => angleSlice * i)
                    .innerRadius(0)
                    .outerRadius(d => rScale(d.value))
                    .curve(d3.curveLinearClosed)

                // Draw the area in the areas group
                areasGroup.append("path")
                    .datum(group.metrics)
                    .attr("class", `radar-area-${group.politicalView.replace(/\s+/g, '-').toLowerCase()}`)
                    .attr("d", radarArea)
                    .style("fill", colorScale(group.politicalView))
                    .style("fill-opacity", 0.2)
                    .style("stroke", colorScale(group.politicalView))
                    .style("stroke-width", "2px")

                // Draw the outline in the areas group
                areasGroup.append("path")
                    .datum(group.metrics)
                    .attr("class", `radar-line-${group.politicalView.replace(/\s+/g, '-').toLowerCase()}`)
                    .attr("d", radarLine)
                    .style("fill", "none")
                    .style("stroke", colorScale(group.politicalView))
                    .style("stroke-width", "3px")
            })

            // Draw data points in the points group (drawn last so they're on top)
            data.radarData.forEach((group) => {
                group.metrics.forEach((metric, i) => {
                    const angle = angleSlice * i - Math.PI / 2
                    const r = rScale(metric.value)
                    const x = r * Math.cos(angle)
                    const y = r * Math.sin(angle)

                    pointsGroup.append("circle")
                        .attr("class", `radar-point-${group.politicalView.replace(/\s+/g, '-').toLowerCase()}`)
                        .attr("cx", x)
                        .attr("cy", y)
                        .attr("r", 5) // Slightly larger for better interaction
                        .style("fill", colorScale(group.politicalView))
                        .style("stroke", "#fff")
                        .style("stroke-width", "2px")
                        .style("cursor", "pointer")
                        .on("mouseover", function (event) {
                            d3.select(this).attr("r", 6) // Enlarge on hover
                            showTooltip(event, group, metric)
                        })
                        .on("mouseout", function () {
                            d3.select(this).attr("r", 5) // Reset size
                            d3.selectAll('.tooltip').remove()
                        })
                })
            })

            // Create legend
            const legend = svg.append("g")
                .attr("transform", `translate(${width - margin.right - 20}, ${margin.top})`) // Move legend 20px more to the left

            // Helper functions for highlighting
            function highlightGroup(politicalView) {
                const classNameSafe = politicalView.replace(/\s+/g, '-').toLowerCase()

                // Fade all elements first
                svg.selectAll('[class*="radar-area-"]').style("fill-opacity", 0.05)
                svg.selectAll('[class*="radar-line-"]').style("stroke-opacity", 0.1)
                svg.selectAll('[class*="radar-point-"]').style("fill-opacity", 0.2)

                // Highlight the selected group
                svg.selectAll(`.radar-area-${classNameSafe}`).style("fill-opacity", 0.4)
                svg.selectAll(`.radar-line-${classNameSafe}`).style("stroke-opacity", 1)
                svg.selectAll(`.radar-point-${classNameSafe}`).style("fill-opacity", 1)
            }

            function resetHighlight() {
                // Reset all elements to default opacity
                svg.selectAll('[class*="radar-area-"]').style("fill-opacity", 0.2)
                svg.selectAll('[class*="radar-line-"]').style("stroke-opacity", 1)
                svg.selectAll('[class*="radar-point-"]').style("fill-opacity", 1)
            }

            function showLegendTooltip(event, group) {
                const tooltip = d3.select("body").append("div")
                    .attr("class", "legend-tooltip")
                    .style("position", "absolute")
                    .style("background", "rgba(0, 0, 0, 0.9)")
                    .style("color", "white")
                    .style("padding", "12px")
                    .style("border-radius", "6px")
                    .style("pointer-events", "none")
                    .style("opacity", 0)
                    .style("font-size", "13px")
                    .style("box-shadow", "0 4px 8px rgba(0,0,0,0.3)")

                const tooltipContent = [
                    `Political View: ${group.politicalView}`,
                    `Sample Size: ${group.count} respondents`,
                    '',
                    'Average Scores:',
                    ...group.metrics.map(metric =>
                        `• ${metric.axis}: ${metric.value.toFixed(2)}`
                    )
                ]

                tooltipContent.forEach((line) => {
                    tooltip.append("div")
                        .text(line)
                        .style("margin", line === '' ? "4px 0" : "2px 0")
                        .style("font-weight", line.includes(':') && !line.includes('•') ? "bold" : "normal")
                })

                tooltip.transition()
                    .duration(200)
                    .style("opacity", 1)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 10) + "px")
            }

            data.radarData.forEach((group, i) => {
                const legendItem = legend.append("g")
                    .attr("transform", `translate(0, ${i * 25})`)
                    .style("cursor", "pointer")
                    .on("mouseover", function (event) {
                        highlightGroup(group.politicalView)
                        showLegendTooltip(event, group)
                    })
                    .on("mouseout", function () {
                        resetHighlight()
                        d3.selectAll('.legend-tooltip').remove()
                    })

                legendItem.append("rect")
                    .attr("width", 15)
                    .attr("height", 15)
                    .style("fill", colorScale(group.politicalView))
                    .style("fill-opacity", 0.7)
                    .style("stroke", colorScale(group.politicalView))
                    .style("stroke-width", "1px")

                legendItem.append("text")
                    .attr("x", 20)
                    .attr("y", 12)
                    .style("font-size", isMobile ? "11px" : "12px")
                    .style("fill", "#333")
                    .text(`${group.politicalView} (n=${group.count})`)
            })

            // Tooltip function
            function showTooltip(event, group, metric) {
                const tooltip = d3.select("body").append("div")
                    .attr("class", "tooltip")
                    .style("position", "absolute")
                    .style("background", "rgba(0, 0, 0, 0.8)")
                    .style("color", "white")
                    .style("padding", "10px")
                    .style("border-radius", "5px")
                    .style("pointer-events", "none")
                    .style("opacity", 0)
                    .style("font-size", "12px")

                const tooltipText = `${group.politicalView}\n${metric.axis}: ${metric.value.toFixed(2)}\nSample size: ${group.count}`

                tooltip.transition()
                    .duration(200)
                    .style("opacity", 1)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px")

                // Handle multi-line text
                const lines = tooltipText.split('\n')
                lines.forEach((line) => {
                    tooltip.append("div").text(line)
                })
            }

            // Add title
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", 30)
                .attr("text-anchor", "middle")
                .style("font-size", isMobile ? "16px" : "18px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text("Verification Metrics by Political View")

            // Add subtitle
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", 50)
                .attr("text-anchor", "middle")
                .style("font-size", isMobile ? "12px" : "14px")
                .style("fill", "#666")
                .text(`Radar chart comparing average verification behaviors (${data.total} respondents)`)
        }

        createRadarChart()
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
                    Loading verification data...
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

export default VerificationRadarChart
