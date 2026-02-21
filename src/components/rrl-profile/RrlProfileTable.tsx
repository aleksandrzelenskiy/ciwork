'use client';

import React, { useMemo, useState } from 'react';
import {
    Card,
    CardContent,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Typography,
} from '@mui/material';
import type { RrlProfileCalculateResponse } from '@/lib/rrl/types';

type Props = {
    result: RrlProfileCalculateResponse;
};

export default function RrlProfileTable({ result }: Props) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const rows = useMemo(
        () => result.samples.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
        [result.samples, page, rowsPerPage]
    );

    return (
        <Card>
            <CardContent>
                <Typography variant='h6' sx={{ mb: 2 }}>Сэмплы профиля</Typography>

                <TableContainer component={Paper} variant='outlined'>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>Dist, м</TableCell>
                                <TableCell>Terrain</TableCell>
                                <TableCell>TerrainEff</TableCell>
                                <TableCell>LoS</TableCell>
                                <TableCell>F1</TableCell>
                                <TableCell>Clearance</TableCell>
                                <TableCell>Clearance60</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((sample) => (
                                <TableRow key={sample.index} hover>
                                    <TableCell>{sample.index}</TableCell>
                                    <TableCell>{sample.distanceMeters.toFixed(1)}</TableCell>
                                    <TableCell>{sample.terrain.toFixed(2)}</TableCell>
                                    <TableCell>{sample.terrainEff.toFixed(2)}</TableCell>
                                    <TableCell>{sample.los.toFixed(2)}</TableCell>
                                    <TableCell>{sample.fresnelR1.toFixed(2)}</TableCell>
                                    <TableCell>{sample.clearance.toFixed(2)}</TableCell>
                                    <TableCell>{sample.clearance60.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component='div'
                        count={result.samples.length}
                        page={page}
                        onPageChange={(_, nextPage) => setPage(nextPage)}
                        rowsPerPage={rowsPerPage}
                        rowsPerPageOptions={[10, 25, 50]}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(Number(event.target.value));
                            setPage(0);
                        }}
                    />
                </TableContainer>
            </CardContent>
        </Card>
    );
}
