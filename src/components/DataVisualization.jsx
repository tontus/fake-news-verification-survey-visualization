import { Container, Grid, Paper, Typography, Box, CircularProgress, useTheme, useMediaQuery } from '@mui/material'
import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import GenderPictorialChart from './GenderPictorialChart'
import EducationChart from './EducationChart'

function DataVisualization() {
    const [csvData, setCsvData] = useState(null)
    const [loading, setLoading] = useState(true)
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))

    // Calculate consistent chart dimensions
    const getChartDimensions = () => {
        // Bootstrap-like container max widths
        const containerMaxWidths = {
            xs: window.innerWidth - 32, // 16px padding each side
            sm: 540 - 48, // 24px padding each side  
            md: 720 - 64, // 32px padding each side
            lg: 960 - 64,
            xl: 1200 - 64
        }

        let containerWidth = containerMaxWidths.xs
        if (window.innerWidth >= 1200) containerWidth = containerMaxWidths.xl
        else if (window.innerWidth >= 960) containerWidth = containerMaxWidths.lg
        else if (window.innerWidth >= 720) containerWidth = containerMaxWidths.md
        else if (window.innerWidth >= 540) containerWidth = containerMaxWidths.sm

        const gridSpacing = 32 // Grid spacing between items (4 * 8px)

        // For desktop: ensure two charts fit in one row with proper spacing
        // For mobile: use full available width
        let chartWidth
        if (isMobile) {
            chartWidth = containerWidth
        } else {
            // Calculate width for two charts per row: (container - spacing) / 2
            chartWidth = (containerWidth - gridSpacing - 100) / 2
        }

        const chartHeight = isMobile ? 350 : 400

        return {
            width: chartWidth,
            height: chartHeight,
            isMobile
        }
    }

    useEffect(() => {
        // Load and parse CSV data once
        fetch('/NormDataPD2.csv')
            .then(response => response.text())
            .then(csvText => {
                Papa.parse(csvText, {
                    header: true,
                    complete: (result) => {
                        console.log('CSV data loaded in DataVisualization:', result.data)
                        setCsvData(result.data)
                        setLoading(false)
                    }
                })
            })
            .catch(error => {
                console.error('Error loading CSV:', error)
                setLoading(false)
            })
    }, [])

    const charts = [
        { id: 'gender', title: 'Gender Distribution', component: GenderPictorialChart },
        { id: 'education', title: 'Education Qualifications', component: EducationChart }
        // Add more chart components here as they are created
    ]

    if (loading) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'column',
                    gap: 2
                }}
            >
                <CircularProgress size={60} />
                <Typography variant="h6" color="text.secondary">
                    Loading survey data...
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#f8f9fa', width: '100%' }}>
            {/* Header */}
            <Box
                sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    py: 4,
                    textAlign: 'center',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    width: '100%'
                }}
            >
                <Typography
                    variant="h2"
                    component="h1"
                    sx={{
                        fontSize: { xs: '1.8rem', sm: '2.5rem', md: '3rem' },
                        mb: 1,
                        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
                        fontWeight: 'bold'
                    }}
                >
                    Fake News Verification Survey
                </Typography>
                <Typography
                    variant="h5"
                    component="p"
                    sx={{
                        fontSize: { xs: '1rem', sm: '1.2rem', md: '1.4rem' },
                        margin: 0,
                        opacity: 0.9
                    }}
                >
                    Interactive Data Visualization Dashboard
                </Typography>
            </Box>

            {/* Chart Content */}
            <Container
                maxWidth="xl"
                sx={{
                    py: 4,
                    px: { xs: 2, sm: 3, md: 4 },
                    minHeight: 'calc(100vh - 200px)',
                    width: '100%',
                    margin: '0 auto', // Center the container
                    maxWidth: { xs: '100%', sm: '540px', md: '720px', lg: '960px', xl: '1200px' } // Bootstrap-like breakpoints
                }}
            >
                <Grid container spacing={4} sx={{ width: '100%' }}>
                    {charts.map(chart => {
                        const ChartComponent = chart.component
                        const dimensions = getChartDimensions()
                        return (
                            <Grid item xs={12} lg={6} key={chart.id}>
                                <Paper
                                    elevation={3}
                                    sx={{
                                        borderRadius: 3,
                                        p: 2,
                                        height: 'fit-content',
                                        border: '1px solid #e9ecef',
                                        transition: 'box-shadow 0.3s ease',
                                        '&:hover': {
                                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
                                        }
                                    }}
                                >
                                <ChartComponent
                                    csvData={csvData}
                                    width={dimensions.width}
                                    height={dimensions.height}
                                    isMobile={dimensions.isMobile}
                                />
                                </Paper>
                            </Grid>
                        )
                    })}
                </Grid>
            </Container>

            {/* Footer */}
            <Box
                sx={{
                    backgroundColor: '#333',
                    color: 'white',
                    textAlign: 'center',
                    py: 2,
                    mt: 4,
                    width: '100%'
                }}
            >
                <Typography variant="body2" sx={{ margin: 0, opacity: 0.8 }}>
                    Fake News Verification Survey Data Visualization © 2025
                </Typography>
            </Box>
        </Box>
    )
}

export default DataVisualization
