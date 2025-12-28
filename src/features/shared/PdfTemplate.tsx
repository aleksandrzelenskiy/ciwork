'use client';

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font
} from '@react-pdf/renderer';

Font.register({
    family: 'Roboto',
    src: '/fonts/Roboto-Regular.ttf',
});

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 12,
        fontFamily: 'Roboto',
    },
    title: {
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    centeredLine: {
        textAlign: 'center',
        marginBottom: 10,
    },
    spacedLine: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    section: {
        marginBottom: 10,
        lineHeight: 1.5,
    },
    signatureTable: {
        width: '100%',
        marginTop: 40,
    },
    signatureRow: {
        flexDirection: 'row',
    },
    signatureCell: {
        padding: 5,
        flex: 1,
    },
    signatureCellDivider: {
        padding: 5,
        width: 30,
    },
    signatureLine: {
        marginTop: 30,
    }
});

interface Props {
    orderNumber: string;
    orderDate: string;
    contractNumber: string;
    contractDate: string;
    completionDate: string;
    objectNumber: string;
    objectAddress: string;
}

export const PdfTemplate = ({
                                orderNumber,
                                orderDate,
                                contractNumber,
                                contractDate,
                                completionDate,
                                objectNumber,
                                objectAddress
                            }: Props) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <Text style={styles.title}>
                УВЕДОМЛЕНИЕ О ГОТОВНОСТИ СДАЧИ РЕЗУЛЬТАТОВ РАБОТ ЗАКАЗЧИКУ
            </Text>

            <Text style={styles.centeredLine}>
                к Заказу № {orderNumber} от {orderDate}
            </Text>

            <Text style={styles.centeredLine}>
                к Договору подряда № {contractNumber} от {contractDate}
            </Text>

            <View style={styles.spacedLine}>
                <Text>г. Иркутск</Text>
                <Text>{completionDate}</Text>
            </View>

            <View style={styles.section}>
                <Text>
                    ООО &quot;Эверест&quot;, юридическое лицо, зарегистрированное по адресу: 672039,
                    Забайкальский край, г. Чита, ул. Красноярская, 32А, стр. 1, этаж 4, пом.
                    10, в лице Директора Гераськова А.С. действующего на основании Устава,
                    именуемое в дальнейшем «Подрядчик», принимая во внимание заключенный
                    между Сторонами Договор подряда № {contractNumber} от {contractDate} (далее
                    -- «Договор подряд»), а также Заказ № {orderNumber} от {orderDate}
                </Text>
                <Text>на выполнение работ (далее -- «Заказ»),</Text>
            </View>

            <View style={styles.section}>
                <Text>
                    настоящим уведомляет ООО «Т2 Мобайл» именуемое в дальнейшем «Заказчик»,
                    о готовности сдачи результатов работ датой {completionDate} г.
                </Text>
                <Text>{objectNumber} расположенному по адресу: {objectAddress}</Text>
            </View>

            {/* Таблица подписи без границ */}
            <View style={styles.signatureTable}>
                <View style={styles.signatureRow}>
                    <View style={styles.signatureCell}>
                        <Text>ПОДРЯДЧИК</Text>
                    </View>
                    <View style={styles.signatureCellDivider}></View>
                    <View style={styles.signatureCell}></View>
                </View>
                <View style={styles.signatureRow}>
                    <View style={styles.signatureCell}>
                        <Text>Директор ООО «Эверест»</Text>
                    </View>
                    <View style={styles.signatureCellDivider}></View>
                    <View style={styles.signatureCell}></View>
                </View>
                <View style={styles.signatureRow}>
                    <View style={styles.signatureCell}>
                        <Text style={styles.signatureLine}>
                            _____________________ / Гераськов А.С. /
                        </Text>
                    </View>
                    <View style={styles.signatureCellDivider}></View>
                    <View style={styles.signatureCell}></View>
                </View>
            </View>
        </Page>
    </Document>
);