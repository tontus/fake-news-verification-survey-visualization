import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { Box, Typography, CircularProgress } from '@mui/material'

function PoliticalViewChart({ csvData, width = 700, height = 400, isMobile = false }) {
    const svgRef = useRef()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    const processData = useCallback((rawData) => {
        // Debug: Check what columns are available
        console.log('Raw data sample:', rawData[0])
        console.log('Available columns:', Object.keys(rawData[0] || {}))

        // Filter out empty rows and count political view distribution
        const cleanData = rawData.filter(row =>
            row.political_view && row.political_view.trim() !== ''
        )

        console.log('Clean data count:', cleanData.length)

        // Count political views
        const politicalViewCounts = {}
        cleanData.forEach(row => {
            const politicalView = row.political_view.trim()
            politicalViewCounts[politicalView] = (politicalViewCounts[politicalView] || 0) + 1
        })

        console.log('Political view counts:', politicalViewCounts)

        // Convert to array and calculate percentages
        const total = cleanData.length
        const chartData = Object.keys(politicalViewCounts)
            .map(view => ({
                view: view,
                count: politicalViewCounts[view],
                percentage: ((politicalViewCounts[view] / total) * 100).toFixed(1)
            }))
            .sort((a, b) => b.count - a.count) // Sort by count descending

        console.log('Final chart data:', chartData)
        setData({ chartData, total })
    }, [])

    useEffect(() => {
        if (csvData) {
            console.log('Processing CSV data in PoliticalViewChart:', csvData)
            processData(csvData)
            setLoading(false)
        }
    }, [csvData, processData])

    useEffect(() => {
        if (!data) return

        const createBarChart = () => {
            const svg = d3.select(svgRef.current)
            svg.selectAll("*").remove() // Clear previous content

            const margin = {
                top: 80,
                right: 30,
                bottom: isMobile ? 120 : 80,
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
                .domain(data.chartData.map(d => d.view))
                .range([0, chartWidth])
                .padding(0.2)

            const yScale = d3.scaleLinear()
                .domain([0, d3.max(data.chartData, d => d.count)])
                .range([chartHeight, 0])

            // Create color scale
            const colorScale = d3.scaleOrdinal()
                .domain(data.chartData.map(d => d.view))
                .range(['#e74c3c']) // Match consistent color scheme

            // Add bars
            g.selectAll('.bar')
                .data(data.chartData)
                .enter()
                .append('rect')
                .attr('class', 'bar')
                .attr('x', d => xScale(d.view))
                .attr('y', d => yScale(d.count))
                .attr('width', xScale.bandwidth())
                .attr('height', d => chartHeight - yScale(d.count))
                .attr('fill', d => colorScale(d.view))
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

            // Add value labels on top of bars
            g.selectAll('.value-label')
                .data(data.chartData)
                .enter()
                .append('text')
                .attr('class', 'value-label')
                .attr('x', d => xScale(d.view) + xScale.bandwidth() / 2)
                .attr('y', d => yScale(d.count) - 5)
                .attr('text-anchor', 'middle')
                .style('font-size', isMobile ? '10px' : '12px')
                .style('font-weight', 'bold')
                .style('fill', '#333')
                .text(d => d.count)

            // Add percentage labels
            g.selectAll('.percentage-label')
                .data(data.chartData)
                .enter()
                .append('text')
                .attr('class', 'percentage-label')
                .attr('x', d => xScale(d.view) + xScale.bandwidth() / 2)
                .attr('y', d => yScale(d.count) - 20)
                .attr('text-anchor', 'middle')
                .style('font-size', isMobile ? '9px' : '11px')
                .style('fill', '#666')
                .text(d => `${d.percentage}%`)

            // Add X axis
            const xAxis = g.append("g")
                .attr("transform", `translate(0, ${chartHeight})`)
                .call(d3.axisBottom(xScale))

            // Rotate x-axis labels if on mobile or if labels are long
            if (isMobile || data.chartData.some(d => d.view.length > 10)) {
                xAxis.selectAll("text")
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)")
                    .style("font-size", isMobile ? "10px" : "12px")
            } else {
                xAxis.selectAll("text")
                    .style("font-size", isMobile ? "10px" : "12px")
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
                .text("Number of Respondents")

            // Add X axis label
            g.append("text")
                .attr("transform", `translate(${chartWidth / 2}, ${chartHeight + margin.bottom - 10})`)
                .style("text-anchor", "middle")
                .style("font-size", isMobile ? "12px" : "14px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text("Political View")

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

                const tooltipText = `${d.view}: ${d.count} respondents (${d.percentage}%)`

                tooltip.transition()
                    .duration(200)
                    .style("opacity", 1)
                    .text(tooltipText)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px")
            }

            // Add title
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", 30)
                .attr("text-anchor", "middle")
                .style("font-size", isMobile ? "16px" : "18px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text("Political View Distribution")

            // Add subtitle
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", 50)
                .attr("text-anchor", "middle")
                .style("font-size", isMobile ? "12px" : "14px")
                .style("fill", "#666")
                .text(`Survey responses showing political view preferences (${data.total} respondents)`)
        }

        createBarChart()
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
                    Loading political view data...
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

export default PoliticalViewChart
