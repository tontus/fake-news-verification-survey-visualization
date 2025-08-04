import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { Box, Typography, CircularProgress } from '@mui/material'

function SocialMediaShareBoxPlotChart({ csvData, width = 700, height = 400, isMobile = false }) {
    const svgRef = useRef()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    const processData = useCallback((rawData) => {
        // Debug: Check what columns are available
        console.log('Raw data sample:', rawData[0])
        console.log('Available columns:', Object.keys(rawData[0] || {}))

        // Filter out empty rows and get clean data
        const cleanData = rawData.filter(row =>
            row.minute_per_day && row.minute_per_day.trim() !== '' &&
            row.share_per_week && row.share_per_week.trim() !== '' &&
            !isNaN(parseFloat(row.minute_per_day)) &&
            !isNaN(parseFloat(row.share_per_week))
        )

        console.log('Clean data count:', cleanData.length)

        // Convert to numbers
        const processedData = cleanData.map(row => ({
            minutesPerDay: parseFloat(row.minute_per_day),
            sharePerWeek: parseFloat(row.share_per_week)
        }))

        // Get min and max minutes to create 5 groups
        const minMinutes = d3.min(processedData, d => d.minutesPerDay)
        const maxMinutes = d3.max(processedData, d => d.minutesPerDay)

        console.log('Minutes range:', minMinutes, 'to', maxMinutes)

        // Create 5 equal groups
        const groupSize = (maxMinutes - minMinutes) / 5
        const groups = []

        for (let i = 0; i < 5; i++) {
            const groupMin = minMinutes + (i * groupSize)
            const groupMax = i === 4 ? maxMinutes : minMinutes + ((i + 1) * groupSize)

            const groupData = processedData.filter(d =>
                d.minutesPerDay >= groupMin && d.minutesPerDay <= groupMax
            )

            if (groupData.length > 0) {
                const shareData = groupData.map(d => d.sharePerWeek).sort((a, b) => a - b)

                // Calculate quartiles
                const q1 = d3.quantile(shareData, 0.25)
                const median = d3.quantile(shareData, 0.5)
                const q3 = d3.quantile(shareData, 0.75)
                const min = d3.min(shareData)
                const max = d3.max(shareData)

                // Calculate IQR and outliers
                const iqr = q3 - q1
                const lowerFence = q1 - 1.5 * iqr
                const upperFence = q3 + 1.5 * iqr

                const outliers = shareData.filter(d => d < lowerFence || d > upperFence)
                const nonOutliers = shareData.filter(d => d >= lowerFence && d <= upperFence)

                groups.push({
                    group: i + 1,
                    label: `${Math.round(groupMin)}-${Math.round(groupMax)} min`,
                    range: [groupMin, groupMax],
                    count: groupData.length,
                    quartiles: {
                        min: d3.min(nonOutliers) || min,
                        q1,
                        median,
                        q3,
                        max: d3.max(nonOutliers) || max
                    },
                    outliers: outliers,
                    rawData: shareData
                })
            }
        }

        console.log('Grouped data:', groups)
        setData({ groups, total: processedData.length })
    }, [])

    useEffect(() => {
        if (csvData) {
            console.log('Processing CSV data in SocialMediaShareBoxPlotChart:', csvData)
            processData(csvData)
            setLoading(false)
        }
    }, [csvData, processData])

    useEffect(() => {
        if (!data) return

        const createBoxPlot = () => {
            const svg = d3.select(svgRef.current)
            svg.selectAll("*").remove() // Clear previous content

            const margin = {
                top: 80,
                right: 30,
                bottom: isMobile ? 100 : 80,
                left: isMobile ? 60 : 80
            }
            const chartWidth = width - margin.left - margin.right
            const chartHeight = height - margin.top - margin.bottom

            svg.attr("width", width)
                .attr("height", height)

            const g = svg.append("g")
                .attr("transform", `translate(${margin.left}, ${margin.top})`)

            // Create scales
            const xScale = d3.scaleBand()
                .domain(data.groups.map(d => d.label))
                .range([0, chartWidth])
                .padding(0.3)

            const allValues = data.groups.flatMap(d => [
                ...d.rawData,
                ...d.outliers
            ])
            const yScale = d3.scaleLinear()
                .domain([0, d3.max(allValues)])
                .range([chartHeight, 0])

            // Create color scale matching your theme
            const boxColor = '#1d2932ff'
            const medianColor = '#e74c3c'
            const outlierColor = '#f39c12'

            // Draw box plots
            data.groups.forEach(group => {
                const x = xScale(group.label)
                const boxWidth = xScale.bandwidth() * 0.6
                const boxX = x + (xScale.bandwidth() - boxWidth) / 2

                // Draw vertical line (whiskers)
                g.append('line')
                    .attr('x1', x + xScale.bandwidth() / 2)
                    .attr('x2', x + xScale.bandwidth() / 2)
                    .attr('y1', yScale(group.quartiles.min))
                    .attr('y2', yScale(group.quartiles.max))
                    .attr('stroke', boxColor)
                    .attr('stroke-width', 2)

                // Draw box (IQR)
                g.append('rect')
                    .attr('x', boxX)
                    .attr('y', yScale(group.quartiles.q3))
                    .attr('width', boxWidth)
                    .attr('height', yScale(group.quartiles.q1) - yScale(group.quartiles.q3))
                    .attr('fill', '#000000')
                    .attr('fill-opacity', 0.3)
                    .attr('stroke', boxColor)
                    .attr('stroke-width', 2)

                // Draw median line
                g.append('line')
                    .attr('x1', boxX)
                    .attr('x2', boxX + boxWidth)
                    .attr('y1', yScale(group.quartiles.median))
                    .attr('y2', yScale(group.quartiles.median))
                    .attr('stroke', medianColor)
                    .attr('stroke-width', 3)

                // Draw whisker caps
                const capWidth = boxWidth * 0.3
                // Min cap
                g.append('line')
                    .attr('x1', x + xScale.bandwidth() / 2 - capWidth / 2)
                    .attr('x2', x + xScale.bandwidth() / 2 + capWidth / 2)
                    .attr('y1', yScale(group.quartiles.min))
                    .attr('y2', yScale(group.quartiles.min))
                    .attr('stroke', boxColor)
                    .attr('stroke-width', 2)

                // Max cap
                g.append('line')
                    .attr('x1', x + xScale.bandwidth() / 2 - capWidth / 2)
                    .attr('x2', x + xScale.bandwidth() / 2 + capWidth / 2)
                    .attr('y1', yScale(group.quartiles.max))
                    .attr('y2', yScale(group.quartiles.max))
                    .attr('stroke', boxColor)
                    .attr('stroke-width', 2)

                // Draw outliers
                group.outliers.forEach(outlier => {
                    g.append('circle')
                        .attr('cx', x + xScale.bandwidth() / 2)
                        .attr('cy', yScale(outlier))
                        .attr('r', 3)
                        .attr('fill', outlierColor)
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 1)
                        .style('cursor', 'pointer')
                        .on('mouseover', function (event) {
                            showTooltip(event, group, 'outlier', outlier)
                        })
                        .on('mouseout', function () {
                            d3.selectAll('.tooltip').remove()
                        })
                })

                // Add invisible hover area for box plot info
                g.append('rect')
                    .attr('x', boxX)
                    .attr('y', yScale(group.quartiles.max))
                    .attr('width', boxWidth)
                    .attr('height', yScale(group.quartiles.min) - yScale(group.quartiles.max))
                    .attr('fill', 'transparent')
                    .style('cursor', 'pointer')
                    .on('mouseover', function (event) {
                        showTooltip(event, group, 'box')
                    })
                    .on('mouseout', function () {
                        d3.selectAll('.tooltip').remove()
                    })
            })

            // Add X axis
            const xAxis = g.append("g")
                .attr("transform", `translate(0, ${chartHeight})`)
                .call(d3.axisBottom(xScale))

            // Rotate x-axis labels if needed
            if (isMobile) {
                xAxis.selectAll("text")
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)")
                    .style("font-size", "10px")
            } else {
                xAxis.selectAll("text")
                    .style("font-size", "12px")
            }

            // Add Y axis
            g.append("g")
                .call(d3.axisLeft(yScale))
                .selectAll("text")
                .style("font-size", isMobile ? "10px" : "12px")

            // Add Y axis label
            g.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (chartHeight / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("font-size", isMobile ? "12px" : "14px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text("Shares per Week")

            // Add X axis label
            g.append("text")
                .attr("transform", `translate(${chartWidth / 2}, ${chartHeight + margin.bottom - 10})`)
                .style("text-anchor", "middle")
                .style("font-size", isMobile ? "12px" : "14px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text("Minutes per Day on Social Media")

            // Tooltip function
            function showTooltip(event, group, type, value = null) {
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

                let tooltipText = ''
                if (type === 'outlier') {
                    tooltipText = `Outlier: ${value} shares/week\nGroup: ${group.label}\nSample size: ${group.count}`
                } else {
                    tooltipText = `Group: ${group.label}\nSample size: ${group.count}\nMedian: ${group.quartiles.median.toFixed(1)} shares/week\nQ1: ${group.quartiles.q1.toFixed(1)}\nQ3: ${group.quartiles.q3.toFixed(1)}\nRange: ${group.quartiles.min.toFixed(1)} - ${group.quartiles.max.toFixed(1)}`
                }

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
                .text("Shares per Week by Social Media Usage")

            // Add subtitle
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", 50)
                .attr("text-anchor", "middle")
                .style("font-size", isMobile ? "12px" : "14px")
                .style("fill", "#666")
                .text(`Box plot showing distribution across usage groups (${data.total} respondents)`)
        }

        createBoxPlot()
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
                    Loading social media sharing data...
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

export default SocialMediaShareBoxPlotChart
